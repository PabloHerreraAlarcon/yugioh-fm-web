/* Interface shell: keeps the existing canvas, runtime and native-mod controls. */
(()=>{
 const $=s=>document.querySelector(s);
 const header=$('.app-header');
 const legacyStatus=$('.header-status');legacyStatus.hidden=true;
 header.querySelector('.brand').remove();
 header.insertAdjacentHTML('afterbegin','<a class="ui-brand" href="/">FM<span>FORBIDDEN MEMORIES<small>ANIME DUEL CUTINS</small></span></a><nav class="ui-nav" aria-label="Principal"><button data-ui-panel="settings">Ajustes</button><button data-ui-panel="controls">Controles</button><button data-ui-panel="mods">Mods</button></nav><div class="ui-header-actions"><button id="ui-theme">Tema claro</button></div>');
 const sidebar=$('.sidebar-section');sidebar.id='ui-settings';sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');sidebar.setAttribute('aria-label','Configuración del juego');sidebar.hidden=true;
 sidebar.insertAdjacentHTML('afterbegin','<div class="ui-panel-heading"><h2>A tu manera</h2><button id="ui-close" aria-label="Cerrar ajustes">×</button></div>');
 const veil=document.createElement('div');veil.className='ui-veil';veil.hidden=true;document.body.append(veil);
 const live=document.createElement('p');live.className='ui-live';live.setAttribute('role','status');document.body.append(live);
 let previousFocus;
 function close(){sidebar.hidden=true;veil.hidden=true;document.body.style.overflow='';previousFocus?.focus()}
 function open(panel){if(window.yfmSelectPanel){window.yfmSelectPanel(panel);return}previousFocus=document.activeElement;sidebar.hidden=false;veil.hidden=false;document.body.style.overflow='hidden';document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===panel));document.querySelectorAll('.tab-content').forEach(p=>p.classList.toggle('active',p.id==='tab-'+panel));$('#ui-close').focus()}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-ui-panel]');if(b)open(b.dataset.uiPanel)});
 $('#ui-close').onclick=close;veil.onclick=close;
 document.addEventListener('keydown',e=>{if(sidebar.hidden||sidebar.getAttribute('role')!=='dialog')return;if(e.key==='Escape'){e.preventDefault();close()}else if(e.key==='Tab'){const nodes=[...sidebar.querySelectorAll('button,input,select,a[href],summary')].filter(n=>!n.disabled&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}});
 function syncTheme(){const dark=document.documentElement.dataset.theme!=='light';$('#ui-theme').textContent=dark?'Tema claro':'Tema oscuro';$('#ui-theme').setAttribute('aria-label',dark?'Cambiar a tema claro':'Cambiar a tema oscuro')}
 $('#ui-theme').onclick=()=>{const theme=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('yfm_mockup_theme',theme)}catch{}syncTheme()};syncTheme();
 const toolbar=$('.duel-toolbar');toolbar.insertAdjacentHTML('beforeend','<div class="ui-tools"><button data-ui-panel="settings">Sonido y partidas</button><button data-ui-panel="controls">Controles</button><button data-ui-panel="mods">Mods</button></div>');
 $('#btn-fullscreen').innerHTML='Pantalla completa';
 $('#btn-play-solo').textContent='Jugar ahora';
 $('#btn-pick-custom-rom').textContent='Elegir mi disco (.bin / .iso)';
 document.querySelectorAll('.tab-btn').forEach(b=>{const names={settings:'Sonido y partidas',controls:'Controles',mods:'Mods'};if(names[b.dataset.tab])b.textContent=names[b.dataset.tab]});
 document.addEventListener('keydown',e=>{if(!sidebar.hidden&&sidebar.contains(e.target))e.stopPropagation()});document.addEventListener('keyup',e=>{if(!sidebar.hidden&&sidebar.contains(e.target))e.stopPropagation()});
 const note=document.createElement('p');note.className='ui-note';note.textContent='Los ajustes de mods se aplican al iniciar. La resolución interna empieza en ×4. El sonido completo y otras opciones de vídeo están disponibles en el menú del juego.';$('#tab-settings').prepend(note);
 $('.game-viewport-section').insertAdjacentHTML('afterend','<section class="ui-roadmap"><div><span>EL SIGUIENTE CAPÍTULO</span><h2>Más formas de jugar.</h2><p>Duelo online para dos jugadores, elección de mazos y torneos: en desarrollo.</p></div><span class="ui-tag">Próximamente</span></section>');
 // Do not expose incomplete online actions or demonstration outcomes.
 ['btn-play-online','btn-quick-chat','btn-forfeit','btn-duel-menu'].forEach(id=>{const n=document.getElementById(id);if(n)n.hidden=true});
 document.querySelectorAll('[data-tab="online"],[data-tab="chat"]').forEach(n=>n.hidden=true);
 $('.result-stats')?.setAttribute('hidden','');$('#btn-result-replay')?.setAttribute('hidden','');$('#btn-result-title')?.setAttribute('hidden','');
 const observer=new MutationObserver(()=>{const loading=!$('#sync-modal').classList.contains('hidden');const running=$('#start-screen').classList.contains('hidden');document.body.classList.toggle('game-running',running);live.textContent=loading?'Cargando el juego…':running?'Haz clic en el juego para usar el teclado.':''});observer.observe($('#start-screen'),{attributes:true,attributeFilter:['class']});observer.observe($('#sync-modal'),{attributes:true,attributeFilter:['class']});
 window.addEventListener('DOMContentLoaded',()=>{const canvas=$('#canvas');canvas.addEventListener('pointerdown',()=>canvas.focus());});
})();


