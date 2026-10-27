import { setupTouchOptions } from './touch-options.js?v=1';
import { setupGamepadPanel } from './gamepad-panel.js?v=3';
const KEY = 'yfm_web_settings_v1';
const fields = ['master_volume','music_volume','sfx_volume','internal_scale','aspect','filter','show_hud','hd_text'];
function preferences() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
export function engineStartupOptions() {
    const saved = preferences(), result = {};
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
    const bounds = [[0,100],[0,100],[0,100],[1,4],[0,2],[0,2],[0,2],[0,1]];
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
            try { localStorage.setItem(KEY,JSON.stringify(saved)); hint.textContent='Ajustes aplicados al juego y guardados.'; }
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
    const intro=graphics.querySelector('.reference-intro');if(intro)intro.textContent='Los ajustes se aplican al juego. Resolución predeterminada: ×4.';
    const row=document.createElement('label');row.className='setting-slider';const title=document.createElement('span');title.textContent='Resolución interna';const resolution=document.createElement('select');resolution.setAttribute('aria-label','Resolución interna');
    for(const scale of [1,2,3,4]){const option=document.createElement('option');option.value=scale;option.textContent='×'+scale;resolution.append(option);}row.append(title,resolution);graphics.prepend(row);
    bind(resolution,3,n=>Number(n.value),(n,v)=>n.value=v);
    const wide=document.getElementById('widescreen-toggle');wide.parentElement.querySelector('span').textContent='Panorámico 16:9';bind(wide,4,n=>n.checked?2:0,(n,v)=>{n.checked=v===2;localStorage.setItem('yfm_widescreen',n.checked?'1':'0');const screen=document.getElementById('screen-container');screen.style.aspectRatio=n.checked?'16/9':'4/3';screen.style.setProperty('--player-aspect',n.checked?'16/9':'4/3');});
    const smooth=document.getElementById('hd-toggle');bind(smooth,5,n=>n.checked?1:0,(n,v)=>{n.checked=v!==0;getModule().canvas.style.imageRendering=v?'auto':'pixelated';});
    function toggle(label,index) {const row=document.createElement('label');row.className='setting-toggle';const text=document.createElement('span');text.textContent=label;const input=document.createElement('input');input.type='checkbox';row.append(text,input);graphics.append(row);bind(input,index,n=>Number(n.checked),(n,v)=>n.checked=v!==0);}
    toggle('Mostrar FPS',6);toggle('Texto HD',7);
    const graphicsHelp=graphics.querySelector('.reference-help');if(graphicsHelp)graphicsHelp.textContent='Una resolución mayor exige más al equipo. El arte HD y las animaciones se activan en Mods.';
    const edit=document.createElement('button');edit.className='btn btn-stone';edit.textContent='Configurar teclado y mando';edit.disabled=true;
    const panel=document.getElementById('tab-controls');panel.prepend(edit);
    setupGamepadPanel(getModule,panel,edit);
    setupTouchOptions(panel);
    window.addEventListener('yfm-engine-ready',()=>{
        const module=getModule();ready=typeof module?._YfmWeb_GetSetting==='function' && typeof module?._YfmWeb_SetSetting==='function';
        if(!ready){hint.textContent='Este motor necesita actualizarse para utilizar los ajustes.';return;}
        if(module._YfmWeb_GetSetting(3)>4)module._YfmWeb_SetSetting(3,4);
        for(const control of controls){control.node.disabled=false;control.write(control.node,module._YfmWeb_GetSetting(control.index));}
        edit.disabled=false;hint.textContent='Los ajustes modifican el juego y se conservan al recargar.';
    });
    const originalGuide=panel.querySelector('.controls-guide');if(originalGuide)originalGuide.setAttribute('aria-label','Guía de controles predeterminados');
    for (const button of document.querySelectorAll('.reference-period button')) {button.disabled=true;button.title='Clasificación online pendiente';}
    const online=document.getElementById('entry-online');online.disabled=true;online.textContent='Online · Próximamente';online.removeAttribute('aria-expanded');
}
