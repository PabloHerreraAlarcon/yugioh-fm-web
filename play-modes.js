const query=new URLSearchParams(location.search);
const complete=query.get('play')==='complete';
const primary=document.getElementById('btn-play-solo');
const online=document.getElementById('entry-online');
// Keep the optional local-disc picker in Partidas, outside the launch choices.
const discPicker=document.getElementById('btn-pick-custom-rom');
const savesPanel=document.getElementById('tab-saves');
if(discPicker && savesPanel)savesPanel.append(discPicker);
function describePlay(button,isComplete){
 button.replaceChildren();
 const title=document.createElement('span');title.textContent=isComplete?'Descargar y jugar':'Jugar ahora';
 const description=document.createElement('small');description.textContent=isComplete?'Descarga completa antes de empezar.':'Inicio rápido; los datos se cargan mientras juegas.';
 description.style.cssText='display:block;font-size:11px;font-weight:400;line-height:1.5;opacity:.85;margin-top:4px';
 button.append(title,description);button.style.whiteSpace='normal';
}
if(primary){
 describePlay(primary,complete);
 const other=document.createElement('button');other.type='button';other.id='entry-other-mode';other.className=primary.className;other.style.cssText='background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.2)';
 describePlay(other,!complete);
 other.addEventListener('click',()=>{const target=new URL(location.href);if(complete)target.searchParams.delete('play');else target.searchParams.set('play','complete');target.searchParams.set('autostart','1');location.assign(target.href);});
 primary.after(other);

}
if(online){online.textContent='Duelo online · Próximamente';online.disabled=true;online.onclick=null;}
await import(complete?'./app-mods-preview.js?v=production43':'./app-instant.js?v=production43');
const autoStart=()=>{if(query.get('autostart')!=='1')return;
 if(!query.has('disc')||query.get('disc')!=='local'){window.yfmRememberedDisc=true;primary?.click();}
 const clean=new URL(location.href);clean.searchParams.delete('autostart');history.replaceState(null,'',clean.href);
};
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',autoStart,{once:true});else autoStart();

if(!complete){
 const status=document.createElement('div');status.style.cssText='display:none;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;color:#9db3c9;font-size:11px';status.setAttribute('aria-label','Preparación en segundo plano');
 const text=document.createElement('span'),pause=document.createElement('button');pause.type='button';pause.textContent='Pausar';pause.style.cssText='background:transparent;color:inherit;border:1px solid #385063;border-radius:6px;padding:6px 10px;font:inherit';
 pause.addEventListener('click',()=>{if(!window.Module)return;window.Module.yfmBackgroundPaused=!window.Module.yfmBackgroundPaused;pause.textContent=window.Module.yfmBackgroundPaused?'Reanudar':'Pausar';});status.append(text,pause);
 document.querySelector('.duel-toolbar')?.after(status);
 setInterval(()=>{const bg=window.yfmStreamReport?.background;if(!bg)return;status.style.display='flex';const paused=window.Module?.yfmBackgroundPaused||bg.state==='paused';text.textContent=bg.state==='complete'?'Preparación en segundo plano terminada.':bg.state==='storage-full'?'Preparación detenida: almacenamiento lleno.':`Preparación en segundo plano: ${bg.done} / ${bg.total}${paused?' · En pausa':''}`;pause.hidden=['complete','storage-full','stopped'].includes(bg.state);},1000);
}
