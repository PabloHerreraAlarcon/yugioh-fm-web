(()=>{
  const theme=document.getElementById('guide-theme');
  function themeLabel(){theme.textContent=document.documentElement.dataset.theme==='light'?'Tema oscuro':'Tema claro';}
  theme?.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;try{localStorage.setItem('yfm_mockup_theme',next);}catch{}themeLabel();});
  if(theme)themeLabel();
  const progress=document.querySelector('.reading-progress i');let scheduled=false;
  function update(){scheduled=false;const span=document.documentElement.scrollHeight-innerHeight;if(progress)progress.style.width=(span>0?Math.min(100,scrollY/span*100):0)+'%';}
  addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}},{passive:true});addEventListener('resize',update);update();
  const sections=[...document.querySelectorAll('.guide-step')];
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){document.querySelectorAll('.guide-toc a').forEach(a=>{if(a.hash==='#'+entry.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}},{rootMargin:'-15% 0px -55% 0px'});sections.forEach(s=>observer.observe(s));}
  document.querySelectorAll('[data-helpful]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-helpful]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));const status=document.getElementById('guide-feedback-status');if(status)status.textContent=button.dataset.helpful==='yes'?'¡Gracias! Ya puedes continuar tu partida. Esta respuesta no se envía.':'Consulta las otras guías del menú para encontrar el siguiente paso. Esta respuesta no se envía.';}));
})();
