import { excludedTestMod } from './mobile-comparison.js?v=2';
// Real engine mods: download before initialization, then mount in private MEMFS.
import { cachedModBytes, finishModPreparation } from './browser-library.js?v=1';
const STORAGE='yfm_native_mods_v1';
let catalogPromise;
const preferences=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||'{}');}catch{return {};}};
const save=p=>localStorage.setItem(STORAGE,JSON.stringify(p));
// Apply the requested PC preset once, including browsers with older choices.
const PC_PRESET='yfm_pc_duel_links_preset_v1';

function getCatalog(){return catalogPromise ||= fetch('/online-assets/catalog.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('No se pudo consultar los mods');return r.json();});}
export function isPhone(userAgent = globalThis.navigator?.userAgent || '') {
 return /iPhone|iPod|Android.*Mobile/i.test(userAgent);
}
function selected(mod,prefs){
 if(excludedTestMod(mod.id))return false;
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
export async function prepareNativeMods(progress=()=>{}, online) {
 if(!online?.mods?.includes("anime-duel-cutins"))throw Error("Anime Duel Cutins es obligatorio en este laboratorio");
 const urls=['/prepared-art-index.json','/image-header-index.json','/startup-pack36.json','/bootstrap-pack.json','/duel-common37.json','/table-banks38.json','/duel-effects39.json'];
 const [verifiedArt,imageHeaders,startupInfo,bootstrapInfo,duelInfo,tableInfo,effectsInfo,catalog]=await Promise.all([...urls.map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('No se pudo consultar '+url);return r.json();}),getCatalog()]);
 const startupTask=cachedModBytes('/startup-pack36.gz?v='+startupInfo.sha256,{path:'startup-pack36.gz',bytes:startupInfo.packedBytes,version:startupInfo.sha256}).then(async packed=>{
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',packed))).map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==startupInfo.sha256)throw Error('Paquete inicial no coincide');
 const raw=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());if(raw.length!==startupInfo.bytes)throw Error('Paquete inicial incompleto');return raw;
 });
 const resourceVersions=new Map(catalog.mods.flatMap(mod=>mod.files.map(file=>['/mods/'+mod.folder+'/'+file.path,file.version])));
 const preparedIsCurrent=(path,version)=>{const proof=verifiedArt[path],pngVersion=resourceVersions.get(path.replace(/\.fm-art\.bin$/,''));return !!(proof && proof.version===version && pngVersion && proof.pngSha256.startsWith(pngVersion));};
 const prefs={},env={MEMORIES_MODS_DIR:'/mods',MEMORIES_SETTINGS:'/game/settings.cfg'},jobs=[],settings=['internal_scale=4','scaling=1'];env.MEMORIES_WEB_VERIFIED_PREPARED='1';
 const catalogBytes=new TextEncoder().encode(JSON.stringify(catalog));
 const actualHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',catalogBytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 if(actualHash!==online.catalogHash)throw Error('Los recursos cambiaron; crea una partida con la nueva version');
 const active=new Set(online.mods);
 for(const id of active)if(!catalog.mods.some(m=>m.id===id&&m.compatible))throw Error('Mod online incompatible: '+id);
 let pack=null,packInfo=null;
 if(active.has('tp7-extra-cards')){packInfo=bootstrapInfo;pack=await cachedModBytes('/bootstrap-pack.bin?v='+packInfo.sha256,{path:'bootstrap-pack.bin',bytes:packInfo.size,version:packInfo.sha256});}

 for(const mod of catalog.mods){
  if(!mod.compatible)continue;
  const enabled=active.has(mod.id);settings.push('mod.'+mod.id+'='+Number(enabled));
  for(const setting of mod.settings)if(!(mod.id==='anime-duel-cutins'&&setting.key==='free_duel_character'))settings.push('mod.'+mod.id+'.'+setting.key+'='+Number(settingValue(mod,setting,prefs)));
  for(const file of mod.files){if(enabled||file.path==='mod.json')jobs.push({...file,folder:mod.folder});}
 }
 let duelTask=null;
 const duelBytes=()=>duelTask ||= cachedModBytes('/duel-common37.gz?v='+duelInfo.sha256,{path:'duel-common37.gz',bytes:duelInfo.packedBytes,version:duelInfo.sha256}).then(async packed=>{
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',packed))).map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==duelInfo.sha256)throw Error('Paquete de duelo no coincide');
 const bytes=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());if(bytes.length!==duelInfo.bytes)throw Error('Paquete de duelo incompleto');return bytes;
 });
 const tableTasks=new Map();
 const tableBytes=bank=>{
  if(!tableTasks.has(bank)){const info=tableInfo.banks[bank];tableTasks.set(bank,cachedModBytes(info.url+'?v='+info.sha256,{path:info.url,bytes:info.packedBytes,version:info.sha256}).then(async packed=>{
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',packed))).map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==info.sha256)throw Error('Animacion de mesa no coincide');
   const raw=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());if(raw.length!==info.bytes)throw Error('Animacion de mesa incompleta');return raw;
  }));}return tableTasks.get(bank);
 };
 let effectsTask;
 const effectsBytes=()=>effectsTask ||= cachedModBytes('/duel-effects39.gz?v='+effectsInfo.sha256,{path:'duel-effects39.gz',bytes:effectsInfo.packedBytes,version:effectsInfo.sha256}).then(async packed=>{
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',packed))).map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==effectsInfo.sha256)throw Error('Efectos no coinciden');const raw=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());if(raw.length!==effectsInfo.bytes)throw Error('Efectos incompletos');return raw;
 });
 const startupBytes=await startupTask;
 const total=jobs.reduce((n,f)=>n+f.bytes,0),files=[];let next=0,loaded=0;const controller=new AbortController();
 await Promise.all(Array.from({length:6},async()=>{
  while(next<jobs.length){const f=jobs[next++];const url='/mod-files/'+[f.folder,...f.path.split('/')].map(encodeURIComponent).join('/')+'?v='+f.version+'&b='+(/\.(json|ini)$/i.test(f.path)?3:2);
   const virtualPath='/mods/'+f.folder+'/'+f.path;const packedEntry=packInfo?.entries[virtualPath];const pre=packedEntry && preparedIsCurrent(virtualPath,f.version) && packedEntry.size===f.bytes?packedEntry:null;const start=startupInfo.entries[virtualPath];const startup=start && start.version===f.version?startupBytes.subarray(start.offset,start.offset+start.size):null;const bytes=f.path==='mod.json'?await cachedModBytes(url,f,{signal:controller.signal}):pre?pack.subarray(pre.offset,pre.offset+pre.size):null;
   files.push({path:'/mods/'+f.folder+'/'+f.path,bytes,url,size:f.bytes,load:async()=>{if(startup)return startup;const effect=effectsInfo.entries[virtualPath];if(effect && effect.version===f.version){const bytes=await effectsBytes();return bytes.subarray(effect.offset,effect.offset+effect.size);}const table=tableInfo.entries[virtualPath];if(table && table.version===f.version){const bytes=await tableBytes(table.bank);return bytes.subarray(table.offset,table.offset+table.size);}const common=duelInfo.entries[virtualPath];if(common && common.version===f.version){const bytes=await duelBytes();return bytes.subarray(common.offset,common.offset+common.size);}return cachedModBytes(url,f);}});loaded+=bytes?.length||0;progress(loaded,total,{processed:next,files:jobs.length});
  }
 })).catch(error=>{controller.abort();throw error;});
 finishModPreparation();
 const backgroundJobs=files.filter(f=>!f.bytes).map(f=>({path:f.path,url:f.url,size:f.size,load:f.load}));
 return {backgroundJobs,env,files,activeMods:[...active],nativeAnime:catalog.mods.some(m=>m.id==='anime-duel-cutins'&&active.has(m.id)),mount(module){
  try{module.FS.mkdir('/game');}catch(e){if(!module.FS.analyzePath('/game').exists)throw e;}
  module.FS.writeFile('/game/settings.cfg',settings.concat(online.settings).join('\n')+'\n');module.yfmImageHeaders=Object.fromEntries(files.filter(f=>imageHeaders[f.path]?.fullHash?.startsWith(new URL(f.url,location.origin).searchParams.get('v')) && imageHeaders[f.path].fullSize===f.size).map(f=>[f.path,imageHeaders[f.path]]));const validHeaderKeys=new Set(Object.entries(module.yfmImageHeaders).map(([path,meta])=>path+':header:'+meta.hash));if(pack)for(const [key,item]of Object.entries(packInfo.entries))if(validHeaderKeys.has(key))module.yfmSeedBytes(key,pack.subarray(item.offset,item.offset+item.size));
  for(const file of files){const parts=file.path.split('/');let dir='';for(const part of parts.slice(1,-1)){dir+='/'+part;try{module.FS.mkdir(dir);}catch(e){if(!module.FS.analyzePath(dir).exists)throw e;}}
   if(file.bytes)module.FS.writeFile(file.path,file.bytes,{canOwn:true});else module.yfmMountDeferred(file.path,new URL(file.url,location.origin).href,file.size,file.load);
   const proof=verifiedArt[file.path];if(proof && preparedIsCurrent(file.path,new URL(file.url,location.origin).searchParams.get('v')))module.FS.writeFile(file.path+'.verified',new Uint8Array(proof.header));
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

