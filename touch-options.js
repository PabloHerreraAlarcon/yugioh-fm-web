const KEY='yfm_touch_controls_v1';
export function touchStartupMode(storage=localStorage){try{const v=storage.getItem(KEY);return ['0','1','2'].includes(v)?v:'0';}catch{return '0';}}
export function setupTouchOptions(panel){
 const box=document.createElement('section');box.className='gamepad-panel';
 box.innerHTML=`<h3>Controles táctiles</h3><p>Para tablets y móviles con pantalla táctil.</p><label>Mostrar botones<select aria-label="Controles táctiles"><option value="0">Automático al tocar el juego</option><option value="1">Siempre visibles</option><option value="2">Ocultos</option></select></label><p data-touch-status role="status">Toca la imagen del juego para mostrar la cruceta, los botones y Start.</p><details><summary>Uso en tablet o móvil</summary><p>Gira la pantalla para jugar en horizontal. Puedes pulsar varios botones a la vez. En automático, usar un teclado o mando vuelve a ocultarlos.</p><p>Durante la partida también puedes cambiarlo en el menú del juego: View → Touch controls.</p></details>`;
 panel.append(box);const select=box.querySelector('select'),status=box.querySelector('[data-touch-status]');select.value=touchStartupMode();
 select.addEventListener('change',()=>{try{localStorage.setItem(KEY,select.value);status.textContent='Guardado para el próximo inicio. Si ya estás jugando, cambia View → Touch controls o guarda tu partida antes de reiniciar.';}catch{status.textContent='No se pudo guardar. Usa View → Touch controls dentro del juego.';}});
}
