import { testProfile } from './mobile-comparison.js?v=1';
// Real engine mods: download before initialization, then mount in private MEMFS.
import { cachedModBytes, finishModPreparation } from './browser-library.js?v=1';
const STORAGE='yfm_native_mods_v1';
let catalogPromise;
const preferences=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||'{}');}catch{return {};}};
const save=p=>localStorage.setItem(STORAGE,JSON.stringify(p));
// Apply the requested PC preset once, including browsers with older choices.
const PC_PRESET='yfm_pc_duel_links_preset_v1';
if(localStorage.getItem(PC_PRESET)!=='1') {
 const prefs=preferences();
 prefs['duel-links-2d-arts']={...prefs['duel-links-2d-arts'],enabled:true,settings:{"size":40,"lift":16,"float":1,"float_period":100,"color":0,"outline_style":0,"outline_width":0,"outline_period":120,"glow":0,"glow_reach":40,"glow_period":90}};
 prefs['3d-monsters']={...prefs['3d-monsters'],enabled:false};
 save(prefs);localStorage.setItem('yfm_widescreen','1');localStorage.setItem(PC_PRESET,'1');
}

function getCatalog(){return catalogPromise ||= fetch('/api/mods',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('No se pudo consultar los mods');return r.json();});}
export function isPhone(userAgent = globalThis.navigator?.userAgent || '') {
 return /iPhone|iPod|Android.*Mobile/i.test(userAgent);
}
function selected(mod,prefs){
 if(testProfile()==='none')return false;
 const defaultEnabled = mod.id === '3d-duel-arena' && isPhone() ? false : mod.enabled;
 return mod.compatible&&(mod.id==='my-mod'||(prefs[mod.id]?.enabled??defaultEnabled));
}
// Explicit choices take precedence over defaults; conflicts are symmetric.
export function resolvedMods(mods,prefs) {
 const enabled=new Set();
 const candidates=mods.filter(m=>selected(m,prefs)).sort((a,b)=>Number(b.id==='my-mod')-Number(a.id==='my-mod')||Number(prefs[b.id]?.enabled===true)-Number(prefs[a.id]?.enabled===true));
 for(const mod of candidates) {
  if(!mods.some(other=>enabled.has(other.id)&&((mod.conflicts||[]).includes(other.id)||(other.conflicts||[]).includes(mod.id))))enabled.add(mod.id);
 }
 return enabled;
}
function settingValue(mod,setting,prefs){return prefs[mod.id]?.settings?.[setting.key]??(mod.id==='3d-monsters'&&setting.key==='style'?1:setting.default);}
export async function prepareNativeMods(progress=()=>{}) {
 const catalog=await getCatalog(),prefs=preferences(),env={MEMORIES_MODS_DIR:'/mods',MEMORIES_SETTINGS:'/game/settings.cfg'},jobs=[],settings=['internal_scale=4','scaling=1'];
 const active=resolvedMods(catalog.mods,prefs);
 for(const mod of catalog.mods){
  if(!mod.compatible)continue;
  const enabled=active.has(mod.id);settings.push('mod.'+mod.id+'='+Number(enabled));
  for(const setting of mod.settings)if(!(mod.id==='anime-duel-cutins'&&setting.key==='free_duel_character'))settings.push('mod.'+mod.id+'.'+setting.key+'='+Number(settingValue(mod,setting,prefs)));
  for(const file of mod.files){if(enabled||file.path==='mod.json')jobs.push({...file,folder:mod.folder});}
 }
 const total=jobs.reduce((n,f)=>n+f.bytes,0),files=[];let next=0,loaded=0;const controller=new AbortController();
 await Promise.all(Array.from({length:6},async()=>{
  while(next<jobs.length){const f=jobs[next++];const url='/mod-files/'+[f.folder,...f.path.split('/')].map(encodeURIComponent).join('/')+'?v='+f.version+'&b='+(/\.(json|ini)$/i.test(f.path)?3:2);
   const bytes=await cachedModBytes(url,f,{signal:controller.signal});
   files.push({path:'/mods/'+f.folder+'/'+f.path,bytes});loaded+=bytes.length;progress(loaded,total);
  }
 })).catch(error=>{controller.abort();throw error;});
 finishModPreparation();
 return {env,files,activeMods:[...active],nativeAnime:catalog.mods.some(m=>m.id==='anime-duel-cutins'&&active.has(m.id)),mount(module){
  try{module.FS.mkdir('/game');}catch(e){if(!module.FS.analyzePath('/game').exists)throw e;}
  module.FS.writeFile('/game/settings.cfg',settings.join('\n')+'\n');
  for(const file of files){const parts=file.path.split('/');let dir='';for(const part of parts.slice(1,-1)){dir+='/'+part;try{module.FS.mkdir(dir);}catch(e){if(!module.FS.analyzePath(dir).exists)throw e;}}
   module.FS.writeFile(file.path,file.bytes,{canOwn:true});
   file.bytes=null; // MEMFS now owns the allocation; release the staging reference.
  }
  files.length=0;
 }};
}
export async function setupNativeModsUI(){
 const pane=document.getElementById('tab-mods');if(!pane)return;
 try{
  const {mods}=await getCatalog(),prefs=preferences(),active=resolvedMods(mods,prefs),controls=new Map();
  // Supersede the old demonstrations with settings connected to the engine.
  for(const child of [...pane.children]){child.hidden=true;child.style.display='none';}
  const group=document.createElement('div');group.className='settings-group';
  const heading=document.createElement('h3');heading.textContent='Mods instalados';group.append(heading);
  const note=document.createElement('p');note.className='ctrl-tip';note.textContent='Se aplican al iniciar. Recarga la página después de cambiar estas opciones.';group.append(note);
  for(const mod of mods){
   if(mod.id==='my-mod'||mod.id==='duel-links-base-aura')continue;
   const section=document.createElement('div');section.className='mod-field';section.style.marginBottom='18px';
   const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.disabled=!mod.compatible;check.checked=active.has(mod.id);
   label.append(check,document.createTextNode(' '+mod.name));section.append(label);
   const status=document.createElement('p');status.className='ctrl-tip';status.textContent=mod.reason||(check.checked?'Activado al iniciar':'Desactivado');section.append(status);
   if(mod.id==='3d-duel-arena'&&isPhone()) {
    const tip=document.createElement('p');tip.className='ctrl-tip';tip.textContent='En celulares comienza desactivado para reducir el trabajo del duelo. Puedes activarlo aquí.';section.append(tip);
   }
   controls.set(mod.id,{check,status});
   check.addEventListener('change',()=>{
    prefs[mod.id]??={};prefs[mod.id].enabled=check.checked;
    if(check.checked)for(const other of mods)if((mod.conflicts||[]).includes(other.id)||(other.conflicts||[]).includes(mod.id)) {
     prefs[other.id]??={};prefs[other.id].enabled=false;
     const control=controls.get(other.id);if(control){control.check.checked=false;control.status.textContent='Desactivado por incompatibilidad con '+mod.name+'. Recarga para aplicar.';}
    }
    save(prefs);status.textContent='Cambio guardado. Recarga para aplicarlo.';
   });
   if(mod.compatible&&mod.settings.length){
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Opciones';details.append(summary);
    for(const setting of mod.settings){
     if(mod.id==='anime-duel-cutins'&&setting.key==='free_duel_character')continue;
     const row=document.createElement('label');row.style.display='block';row.style.margin='10px 0';row.textContent=(mod.id==='3d-monsters'&&setting.key==='style'?'Representación':setting.label||setting.key)+' ';
     let control;
     if(setting.type==='choice'){control=document.createElement('select');control.className='select-ancient';for(const [i,name] of setting.choices.entries()){const opt=document.createElement('option');opt.value=i;opt.textContent=mod.id==='3d-monsters'&&setting.key==='style'?['Modelos 3D','Arte de cartas (más ligero)'][i]:name;control.append(opt);}control.value=settingValue(mod,setting,prefs);}
     else{control=document.createElement('input');control.type=setting.type==='bool'?'checkbox':'number';if(control.type==='checkbox')control.checked=!!settingValue(mod,setting,prefs);else{control.value=settingValue(mod,setting,prefs);for(const key of ['min','max','step'])if(setting[key]!==undefined)control[key]=setting[key];}}
     control.addEventListener('change',()=>{prefs[mod.id]??={};prefs[mod.id].settings??={};prefs[mod.id].settings[setting.key]=control.type==='checkbox'?Number(control.checked):Number(control.value);save(prefs);});row.append(control);details.append(row);
    }section.append(details);
   }group.append(section);
  }
  const apply=document.createElement('button');apply.className='btn btn-stone';apply.textContent='Aplicar mods y reiniciar';apply.type='button';apply.onclick=()=>window.yfmRestartGame?.();group.append(apply);
  pane.prepend(group);
 }catch(error){const warning=document.createElement('p');warning.textContent='No se pudo leer la carpeta de mods: '+error.message;pane.prepend(warning);}
}

