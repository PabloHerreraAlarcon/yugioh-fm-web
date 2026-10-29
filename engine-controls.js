import { setupTouchOptions } from './touch-options.js?v=1';
import { setupGamepadPanel } from './gamepad-panel.js?v=3';
const KEY = 'yfm_web_settings_v1';
const fields = ['master_volume','music_volume','sfx_volume','internal_scale','aspect','filter','show_hud','hd_text','speed','fusion_helper','language','crt','flash','xbr'];
function preferences() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
export function engineStartupOptions() {
    const saved = preferences(), result = {internal_scale:4,hd_text:1};
    // Native menu edits must also survive reload after a field was managed here.
    try {
        const profile=JSON.parse(localStorage.getItem('yfm_native_saves_v1') || '{}');
        const encoded=profile.files?.['engine-settings.cfg'];
        if(encoded) for(const line of atob(encoded).split(/\r?\n/)) {
            const pair=line.match(/^\s*([a-z_]+)\s*=\s*(-?\d+)/);
            if(pair && Object.hasOwn(saved,pair[1])) saved[pair[1]]=Number(pair[2]);
        }
    } catch { /* Keep valid web choices when an old profile cannot be read. */ }
    if(Number.isInteger(saved.internal_scale))saved.internal_scale=Math.min(4,Math.max(1,saved.internal_scale));
    const bounds = [[0,100],[0,100],[0,100],[1,4],[0,2],[0,2],[0,2],[0,1],[-1,400],[0,1],[0,5],[0,1],[0,1],[0,1]];
    for (const [i,key] of fields.entries()) if (Number.isInteger(saved[key]) && saved[key]>=bounds[i][0] && saved[key]<=bounds[i][1]) result[key]=saved[key];
    // Explicit diagnostic override; never persist or change the user's preference.
    const queryScale = new URLSearchParams(globalThis.location?.search || '').get('scale');
    if (/^[1-4]$/.test(queryScale || '')) result.internal_scale = Number(queryScale);
    return result;
}
export function setupEngineControls(getModule) {
    let ready = false;
    const general = document.getElementById('tab-general'), graphics = document.getElementById('tab-graphics');
    const hint = document.createElement('p'); hint.className='ctrl-tip'; hint.setAttribute('role','status'); hint.textContent='Inicia el juego para ajustar sus opciones.';
    general.prepend(hint);
    const controls=[];
    function refresh() {if(ready) for(const control of controls) control.write(control.node,getModule()._YfmWeb_GetSetting(control.index));}
    document.querySelector('.reference-tabs')?.addEventListener('click',refresh);
    window.addEventListener('focus',refresh);
    function bind(node,index,read,write) {
        node.disabled=true; controls.push({node,index,write});
        node.addEventListener(node.type==='range'?'input':'change',()=>{
            if (!ready) return;
            const value=read(node), module=getModule(), result=module._YfmWeb_SetSetting(index,value);
            write(node,module._YfmWeb_GetSetting(index));refresh();
            if (result!==1) { hint.textContent='No se pudo guardar el ajuste. Exporta tu partida antes de cerrar.'; return; }
            const saved=preferences();saved[fields[index]]=value;
            try { localStorage.setItem(KEY,JSON.stringify(saved)); hint.textContent=index===10?'Idioma guardado. Guarda tu partida y pulsa Reiniciar para aplicarlo.':'Ajustes aplicados al juego y guardados.'; }
            catch { hint.textContent='Ajuste aplicado. El navegador no pudo conservarlo para la próxima visita.'; }
        });
    }
    function range(parent,label,index,existing) {
        const row=existing?.parentElement || document.createElement('label');row.className='setting-slider';
        let input=existing;
        if(!input){const text=document.createElement('span');text.textContent=label;input=document.createElement('input');input.type='range';input.min=0;input.max=100;input.step=1;row.append(text,input,document.createElement('span'));parent.append(row);}
        else row.querySelector('span').textContent=label;
        input.setAttribute('aria-label',label);
        bind(input,index,n=>Number(n.value),(n,v)=>{n.value=v;row.lastElementChild.textContent=v+'%';});
    }
    range(general,'Volumen general',0,document.getElementById('volume-slider'));
    range(general,'Música',1);range(general,'Efectos y voces del juego',2);
    const oldHelp=general.querySelector('.reference-help');if(oldHelp)oldHelp.textContent='Los controles de sonido modifican el audio del juego en ejecución.';
    const preset=graphics.querySelector('.reference-setting');if(preset)preset.remove();
    const intro=graphics.querySelector('.reference-intro');if(intro)intro.textContent='Los ajustes se aplican al juego. Resolución predeterminada: ×1.';
    const row=document.createElement('label');row.className='setting-slider';const title=document.createElement('span');title.textContent='Resolución interna';const resolution=document.createElement('select');resolution.setAttribute('aria-label','Resolución interna');
    for(const scale of [1,2,3,4]){const option=document.createElement('option');option.value=scale;option.textContent='×'+scale;resolution.append(option);}row.append(title,resolution);graphics.prepend(row);
    bind(resolution,3,n=>Number(n.value),(n,v)=>n.value=v);
    const wide=document.getElementById('widescreen-toggle');wide.parentElement.querySelector('span').textContent='Panorámico 16:9';bind(wide,4,n=>n.checked?2:0,(n,v)=>{n.checked=v===2;localStorage.setItem('yfm_widescreen',n.checked?'1':'0');const screen=document.getElementById('screen-container');screen.style.aspectRatio=n.checked?'16/9':'4/3';screen.style.setProperty('--player-aspect',n.checked?'16/9':'4/3');});
    const smooth=document.getElementById('hd-toggle');bind(smooth,5,n=>n.checked?1:0,(n,v)=>{n.checked=v!==0;getModule().canvas.style.imageRendering=v?'auto':'pixelated';});
    function toggle(label,index,parent=graphics) {const row=document.createElement('label');row.className='setting-toggle';const text=document.createElement('span');text.textContent=label;const input=document.createElement('input');input.type='checkbox';row.append(text,input);parent.append(row);bind(input,index,n=>Number(n.checked),(n,v)=>n.checked=v!==0);}
    toggle('Mostrar FPS',6);toggle('Texto HD',7);
    function selectOption(parent,label,index,options) {
        const row=document.createElement('label');row.className='setting-slider';const title=document.createElement('span');title.textContent=label;const select=document.createElement('select');select.setAttribute('aria-label',label);
        for(const [value,label] of options){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}row.append(title,select);parent.append(row);bind(select,index,n=>Number(n.value),(n,v)=>n.value=v);
    }
    const solo=document.createElement('section');solo.className='settings-group';const soloTitle=document.createElement('h3');soloTitle.textContent='Juego individual';solo.append(soloTitle);general.append(solo);
    selectOption(solo,'Velocidad del juego',8,[[50,'50%'],[100,'100% · Normal'],[150,'150%'],[200,'200%'],[300,'300%'],[400,'400%'],[-1,'Sin límite']]);
    toggle('Ayuda de fusiones',9,solo);
    selectOption(solo,'Idioma del juego',10,[[0,'English (US)'],[1,'English (Europe)'],[2,'Français'],[3,'Deutsch'],[4,'Italiano'],[5,'Español']]);
    const langHelp=document.createElement('p');langHelp.className='ctrl-tip';langHelp.textContent='El idioma del juego se aplica al reiniciar. Guarda antes tu partida. El idioma de la web se elige en la cabecera.';solo.append(langHelp);
    toggle('Líneas CRT',11);toggle('Reducir destellos',12);toggle('Suavizado de píxeles xBR',13);
    const cheats=document.createElement('details');cheats.className='solo-cheats settings-group';const summary=document.createElement('summary');summary.textContent='Trucos · Juego individual';cheats.append(summary);
    const cheatHelp=document.createElement('p');cheatHelp.className='ctrl-tip';cheatHelp.textContent='Carga una partida y sal del editor de mazos antes de aplicar un truco. Guarda desde el juego para conservar los cambios.';cheats.append(cheatHelp);
    const cheatStatus=document.createElement('p');cheatStatus.className='ctrl-tip';cheatStatus.setAttribute('role','status');cheats.append(cheatStatus);
    const cheatButtons=[];
    const cards=document.createElement('div');cards.className='solo-cheat-card';
    const quantityLabel=document.createElement('label');quantityLabel.textContent='Copias de cada carta';quantityLabel.htmlFor='solo-card-count';
    const quantity=document.createElement('select');quantity.id='solo-card-count';quantity.disabled=true;
    for(const [value,label] of [[1,'1 copia'],[2,'2 copias'],[3,'3 copias']]){const option=document.createElement('option');option.value=value;option.textContent=label;quantity.append(option);}
    cards.append(quantityLabel,quantity);cheats.append(cards);
    const roster=document.createElement('div');roster.className='solo-cheat-card';const rosterTitle=document.createElement('h4');rosterTitle.textContent='Duelo Libre';roster.append(rosterTitle);cheats.append(roster);
    for(const [action,label,parent] of [[0,'Añadir cartas al baúl',cards],[4,'Desbloquear duelistas',roster]]) {
        const button=document.createElement('button');button.type='button';button.className='solo-cheat-action';button.textContent=label;button.disabled=true;parent.append(button);cheatButtons.push(button);
        button.onclick=()=>{const module=getModule();if(!ready || typeof module?._YfmWeb_Cheat!=='function')return;
            const selectedAction=action || Number(quantity.value);
            if(!window.confirm((window.yfmT?.(label)||label)+'\n'+(window.yfmT?.('Esto modifica la partida individual actual. ¿Aplicar?')||'Esto modifica la partida individual actual. ¿Aplicar?')))return;
            const result=module._YfmWeb_Cheat(selectedAction);cheatStatus.textContent=({1:'Truco aplicado. Guarda desde el juego para conservarlo.','-1':'Opción no válida.','-2':'Primero inicia o carga una partida.','-3':'Sal del editor de mazos y vuelve a intentarlo.','-4':'No se pudo aplicar el truco.'})[result]||'No se pudo aplicar el truco.';
        };
    }
    cheats.append(cheatStatus);
    document.getElementById('tab-saves').append(cheats);
    const graphicsHelp=graphics.querySelector('.reference-help');if(graphicsHelp)graphicsHelp.textContent='Una resolución mayor exige más al equipo. El arte HD y las animaciones se activan en Mods.';
    const edit=document.createElement('button');edit.className='btn btn-stone';edit.textContent='Configurar teclado y mando';edit.disabled=true;
    const panel=document.getElementById('tab-controls');panel.prepend(edit);
    setupGamepadPanel(getModule,panel,edit);
    setupTouchOptions(panel);
    window.addEventListener('yfm-engine-ready',()=>{
        const module=getModule();ready=typeof module?._YfmWeb_GetSetting==='function' && typeof module?._YfmWeb_SetSetting==='function';
        if(!ready){hint.textContent='Este motor necesita actualizarse para utilizar los ajustes.';return;}
        if(module._YfmWeb_GetSetting(3)>4)module._YfmWeb_SetSetting(3,4);
        for(const control of controls){const supported=control.index<8 || typeof module._YfmWeb_Cheat==='function';control.node.disabled=!supported;if(supported)control.write(control.node,module._YfmWeb_GetSetting(control.index));}
        for(const button of cheatButtons)button.disabled=typeof module._YfmWeb_Cheat!=='function';quantity.disabled=typeof module._YfmWeb_Cheat!=='function';
        edit.disabled=false;hint.textContent='Los ajustes modifican el juego y se conservan al recargar.';
    });
    const originalGuide=panel.querySelector('.controls-guide');if(originalGuide)originalGuide.setAttribute('aria-label','Guía de controles predeterminados');
    for (const button of document.querySelectorAll('.reference-period button')) {button.disabled=true;button.title='Clasificación online pendiente';}
    const online=document.getElementById('entry-online');online.disabled=true;online.textContent='Online · Próximamente';online.removeAttribute('aria-expanded');
}
