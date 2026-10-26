// Browser diagnostics only. SDL remains the single owner of gameplay input.
export function setupGamepadPanel(getModule, panel, edit) {
    const box=document.createElement('section');box.className='gamepad-panel';
    box.innerHTML=`<h3>Mando USB / Bluetooth</h3><p class="pad-status" role="status" aria-live="polite" data-status></p><p>Conecta tu mando y pulsa un botón. Para jugar, haz clic dentro de la imagen del juego.</p><div data-action></div><p class="pad-note">Inicia el juego para configurar los controles.</p><details><summary>Comprobar botones y ejes</summary><label>Mando <select aria-label="Mando para comprobar"></select></label><p data-mapping></p><p class="pad-input" data-input></p></details><details><summary>Steam Deck · modo Escritorio</summary><p>Con Steam abierto, mantén pulsado ☰ unos 3 segundos para alternar al modo mando. Después pulsa A y comprueba la detección.</p><p>Si no aparece, añade el navegador a Steam como juego externo, ábrelo desde Steam y selecciona la plantilla de controles Gamepad.</p></details><details><summary>Cómo guardar la configuración</summary><p>Asigna los botones en el editor del juego. Pulsa <strong>Apply</strong> para guardar y <strong>Close</strong> para volver.</p><p>Se guarda en este navegador. USB y Bluetooth pueden usar perfiles diferentes.</p></details>`;
    panel.prepend(box);box.querySelector('[data-action]').append(edit);
    window.addEventListener('yfm-engine-ready',()=>{box.querySelector('.pad-note').textContent='Los cambios se guardan en este navegador.';});
    const status=box.querySelector('[data-status]'), select=box.querySelector('select'), mapping=box.querySelector('[data-mapping]'), input=box.querySelector('[data-input]');
    let signature='', previousStatus='', previousInput='';
    function scan() {
        let pads=[];
        try {pads=Array.from(navigator.getGamepads?.()||[]).filter(p=>p?.connected);} catch {status.textContent='El navegador no permite acceder al mando. Abre el juego directamente en Chrome o Edge con HTTPS.';return;}
        const next=pads.map(p=>`${p.index}:${p.id}`).join('|');
        if(next!==signature){
            const old=select.value;select.replaceChildren();
            for(const p of pads){const o=document.createElement('option');o.value=String(p.index);o.textContent=`${p.index+1}. ${p.id}`;select.append(o);}
            if(pads.some(p=>String(p.index)===old))select.value=old;
            signature=next;
        }
        select.disabled=!pads.length;
        const message=!navigator.getGamepads?'Este navegador no ofrece acceso a mandos.':pads.length?`${pads.length===1?'Mando detectado':'Mandos detectados: '+pads.length}.`:'Sin mando conectado.';
        if(message!==previousStatus){status.textContent=message;previousStatus=message;}
        const badge=document.getElementById('gamepad-status');
        if(badge){badge.classList.toggle('connected',!!pads.length);const label=badge.querySelector('.label');if(label)label.textContent=pads.length?'Mando conectado':'Sin mando';badge.title=pads.map(p=>p.id).join('\n');}
        const p=pads.find(p=>String(p.index)===select.value)||pads[0];
        mapping.textContent=p?(p.mapping==='standard'?'Distribución estándar reconocida.':'Distribución genérica: configura sus botones dentro del juego.'):'Compatible con los mandos que reconozca tu navegador.';
        const buttons=p?.buttons.flatMap((b,i)=>b.pressed||b.value>0.5?[String(i+1)]:[])||[];
        const axes=p?.axes.flatMap((v,i)=>Math.abs(v)>0.2?[`${i+1}: ${v.toFixed(2)}`]:[])||[];
        const feedback=p?`Botones: ${buttons.join(', ')||'ninguno'} · Ejes: ${axes.join(' / ')||'en reposo'}`:'Aquí verás los botones y ejes al mover el mando.';
        if(feedback!==previousInput){input.textContent=feedback;previousInput=feedback;}
    }
    // Slow diagnostics, not another per-frame gameplay loop.
    let timer;
    function schedule(){clearTimeout(timer);if(document.hidden)return;scan();timer=setTimeout(schedule,panel.offsetParent===null?1200:120);}
    for(const event of ['gamepadconnected','gamepaddisconnected','focus'])window.addEventListener(event,schedule);
    document.addEventListener('visibilitychange',schedule);select.addEventListener('change',scan);
    edit.textContent='Configurar mando y teclado';
    edit.onclick=()=>{const m=getModule();if(typeof m?._YfmWeb_OpenControls!=='function')return;m._YfmWeb_OpenControls();m.canvas?.focus();};
    schedule();return box;
}
