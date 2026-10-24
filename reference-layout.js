(()=>{
const $=s=>document.querySelector(s);document.body.classList.add('reference-layout');
$('.page-intro').hidden=true;$('.approved-more').hidden=true;$('.approved-game-top').hidden=true;
const layout=$('.approved-play-layout');const retainedPicker=$('#btn-pick-custom-rom');if(retainedPicker)document.body.append(retainedPicker);$('.approved-launch').remove();
const sidebar=$('.sidebar-section');sidebar.hidden=false;sidebar.setAttribute('role','complementary');sidebar.removeAttribute('aria-modal');$('.ui-panel-heading').hidden=true;$('.sidebar-tabs').hidden=true;layout.append(sidebar);
const general=document.createElement('section');general.id='tab-general';general.className='tab-content';
const graphics=document.createElement('section');graphics.id='tab-graphics';graphics.className='tab-content';
const saves=document.createElement('section');saves.id='tab-saves';saves.className='tab-content';
const groups=[...$('#tab-settings').querySelectorAll('.settings-group')];if(groups[0])general.append(groups[0]);if(groups[1])graphics.append(groups[1]);if(groups[2])saves.append(groups[2]);
general.insertAdjacentHTML('afterbegin','<p class="reference-intro">Tus preferencias se guardan en este navegador.</p>');general.insertAdjacentHTML('beforeend','<p class="reference-help">El volumen de música y efectos se ajusta desde el menú Audio del juego.</p>');
graphics.insertAdjacentHTML('afterbegin','<p class="reference-intro">La resolución interna inicial es ×4. Puedes ajustarla en el menú Vídeo del juego.</p><div class="reference-setting"><span>Resolución de inicio</span><strong>4×</strong></div>');graphics.insertAdjacentHTML('beforeend','<p class="reference-help">Los cambios de formato se aplican al reiniciar. El mod HD se configura en Mods.</p>');
sidebar.append(general,graphics,saves);$('#tab-settings').hidden=true;
const online=$('#tab-online'),chat=$('#tab-chat');[...online.children].forEach(n=>n.hidden=true);[...chat.children].forEach(n=>n.hidden=true);
online.insertAdjacentHTML('afterbegin','<div><span class="reference-chip">EN DESARROLLO</span><h3>Duelo con un amigo</h3><p class="reference-intro">El modo online para dos jugadores todavía no está disponible.</p><p class="reference-help">La elección de personaje, mazos y las salas se incorporarán al completar la sincronización del juego.</p></div>');chat.insertAdjacentHTML('afterbegin','<div><h3>Chat de la partida</h3><p class="reference-intro">Estará disponible junto al modo online. No hay una sala conectada.</p></div>');
const tabs=document.createElement('nav');tabs.className='reference-tabs';tabs.setAttribute('aria-label','Configuración');
const definitions=[['general','General'],['graphics','Gráficos'],['online','Online'],['chat','Chat'],['controls','Controles'],['saves','Partidas'],['mods','Mods']];for(const [id,label] of definitions){const b=document.createElement('button');b.className='reference-tab';b.dataset.panel=id;b.textContent=label;b.type='button';b.onclick=()=>select(id,true);tabs.append(b)}sidebar.prepend(tabs);
function select(id,scroll=false){id=({settings:'general'})[id]||id;sidebar.querySelectorAll('.tab-content').forEach(n=>{n.classList.toggle('active',n.id==='tab-'+id)});tabs.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.panel===id);b.setAttribute('aria-pressed',String(b.dataset.panel===id))});if(scroll&&matchMedia('(max-width:1000px)').matches)sidebar.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'})}window.yfmSelectPanel=id=>select(id,true);select('general');

const ranking=document.createElement('aside');ranking.className='reference-ranking';ranking.innerHTML='<h2>MÁS VICTORIAS ONLINE</h2><p>Jugadores con más duelos ganados.</p><div class="reference-period"><button class="selected" data-period="Diario">Diario</button><button data-period="Semanal">Semanal</button></div><table><thead><tr><th>#</th><th>Jugador</th><th>Victorias</th></tr></thead><tbody><tr><td colspan="3">Sin clasificación disponible.</td></tr></tbody></table><p class="reference-help">La clasificación estará disponible cuando se active el modo online y se puedan verificar los resultados.</p>';layout.prepend(ranking);ranking.querySelectorAll('button').forEach(b=>b.onclick=()=>{ranking.querySelectorAll('button').forEach(n=>{n.classList.toggle('selected',n===b);n.setAttribute('aria-pressed',String(n===b))})});
const header=$('.app-header');$('.ui-nav').hidden=true;$('.ui-brand').innerHTML='<span class="reference-logo">FM</span><span class="reference-wordmark">YU-GI-OH! <b>FM</b><small>ANIME DUEL CUTINS · WEB</small></span>';
const info=document.createElement('div');info.className='reference-nav-info';info.innerHTML='<label><span>Idioma</span> <select id="language-select" aria-label="Idioma de la interfaz"><option value="auto">Automático (navegador)</option><option value="es">Español</option><option value="en">English</option><option value="pt">Português</option></select></label><span class="reference-device"><i aria-hidden="true"></i> PC · Teclado y mando</span>';header.insertBefore(info,$('.ui-header-actions'));
const hero=$('.entry-invitation');$('.entry-kicker').innerHTML='<span aria-hidden="true">◆　◆　◆</span>';hero.querySelector('h2').innerHTML='Yu-Gi-Oh! <span>Forbidden Memories</span>';$('.entry-description').textContent='Juega directamente en tu navegador.';$('#btn-play-solo').innerHTML='Jugar ahora';$('#entry-online').innerHTML='Jugar online';$('#entry-online').onclick=()=>{select('online',true);$('#entry-online').setAttribute('aria-expanded','true')};$('#online-development-note').hidden=true;

// Hero Disc Picker & Drag-and-Drop
const actions=$('.entry-actions');const romInput=$('#rom-file-input');
const heroDiscBtn=document.createElement('button');heroDiscBtn.id='btn-hero-disc';heroDiscBtn.type='button';heroDiscBtn.className='btn-hero-disc';
heroDiscBtn.innerHTML='<span>💿</span> <strong>Cargar imagen del juego (.bin / ~500 MB)</strong>';
const heroDiscTip=document.createElement('p');heroDiscTip.className='entry-disc-tip';
heroDiscTip.textContent='Selecciona el archivo .bin del juego (no el .cue de 1 KB) o arrástralo aquí.';
if(actions){actions.prepend(heroDiscTip);actions.prepend(heroDiscBtn);}
heroDiscBtn.onclick=()=>romInput?.click();

function handleChosenRom(file){
 if(!file)return;
 if(file.name.toLowerCase().endsWith('.cue')||file.size<50*1024*1024){
  alert('⚠️ Has seleccionado "'+file.name+'" ('+Math.round(file.size/1024)+' KB).\n\nEse es solo el archivo de índice .cue.\nPor favor selecciona el archivo principal .bin (el que pesa alrededor de 500 MB).');
  if(romInput)romInput.value='';
  return;
 }
 heroDiscBtn.classList.add('disc-loaded');
 heroDiscBtn.innerHTML='<span>✅</span> <strong>Disco listo: '+file.name+' ('+Math.round(file.size/(1024*1024))+' MB)</strong>';
 heroDiscTip.textContent='¡Disco verificado! Pulsa "Jugar ahora" para iniciar.';
 heroDiscTip.style.color='#4ade80';
}
romInput?.addEventListener('change',e=>handleChosenRom(e.target.files?.[0]));

// Drag & drop disc
const dropTarget=$('#start-screen')||$('.screen-frame');
if(dropTarget){
 ['dragenter','dragover'].forEach(ev=>dropTarget.addEventListener(ev,e=>{e.preventDefault();dropTarget.classList.add('drag-over')}));
 ['dragleave','drop'].forEach(ev=>dropTarget.addEventListener(ev,e=>{e.preventDefault();dropTarget.classList.remove('drag-over')}));
 dropTarget.addEventListener('drop',e=>{
  const f=e.dataTransfer?.files?.[0];
  if(f){
   if(romInput){
    const dt=new DataTransfer();dt.items.add(f);romInput.files=dt.files;
    romInput.dispatchEvent(new Event('change',{bubbles:true}));
   }
  }
 });
}

// Intercept Jugar ahora if no disc selected
$('#btn-play-solo')?.addEventListener('click',e=>{
 if(!romInput?.files?.[0]){
  e.stopImmediatePropagation();
  alert('💿 Por favor selecciona primero tu archivo .bin del juego (~500 MB).\n\nHaz clic en "Cargar imagen del juego (.bin)" o arrástralo a la ventana.');
  romInput?.click();
 }
},true);

const section=$('.game-viewport-section');const helper=document.createElement('div');helper.className='reference-controller-tip';helper.innerHTML='<span aria-hidden="true">⌘</span><p><strong>Para usar el mando:</strong> cuando aparezca el juego, haz clic dentro de su imagen y pulsa cualquier botón del mando.</p>';const toolbar=$('.duel-toolbar');toolbar.before(helper);const status=document.createElement('div');status.className='reference-status';status.innerHTML='<span><i aria-hidden="true"></i> <span id="reference-status-text">Listo para jugar.</span></span>';toolbar.before(status);
const full=$('#btn-fullscreen');toolbar.replaceChildren(full);const controls=document.createElement('button');controls.textContent='Controles';controls.onclick=()=>select('controls',true);const restart=document.createElement('button');restart.textContent='Reiniciar';restart.onclick=window.yfmRestartGame=()=>{if(confirm(window.yfmT?.('¿Reiniciar el juego? Se perderá el progreso que no hayas guardado.')||'¿Reiniciar el juego? Se perderá el progreso que no hayas guardado.'))location.reload()};toolbar.append(controls,restart);$('.ui-live').hidden=true;
const disc=$('#btn-pick-custom-rom');disc.textContent='Seleccionar mi disco';disc.hidden=false;saves.prepend(disc);
new MutationObserver(()=>{const loading=!$('#sync-modal').classList.contains('hidden');const active=$('#start-screen').classList.contains('hidden');$('#reference-status-text').textContent=loading?'Cargando el juego…':active?'Juego en ejecución.':'Listo para jugar.'}).observe($('#sync-modal'),{attributes:true,attributeFilter:['class']});
const aspectControl=$('#widescreen-toggle');const updateFit=()=>{$('#screen-container').style.setProperty('--player-aspect',aspectControl.checked?'16/9':'4/3')};aspectControl.addEventListener('change',updateFit);window.addEventListener('DOMContentLoaded',updateFit);updateFit();
const footer=document.createElement('footer');footer.className='reference-footer';footer.innerHTML='<strong>YU-GI-OH! FORBIDDEN MEMORIES</strong><span>Anime Duel Cutins · Proyecto independiente</span>';$('.app-layout').append(footer);
})();





