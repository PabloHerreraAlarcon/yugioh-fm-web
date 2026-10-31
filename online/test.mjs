import {OnlineEngineSession} from './engine-session.mjs?v=network80';
const el=id=>document.getElementById(id),log=t=>{el('log').textContent=(el('log').textContent+'\n'+t).slice(-4000);};
const config=await(await fetch('https://yfm-duel-online.phdigital.workers.dev/online-config')).json();
const character=el('character'),skin=el('skin');
for(const [id,options]of [['life-points',(config.nativeOptions?.lifePoints||[8000]).map(n=>({value:n,label:n+' LP'}))],['duel-music',(config.nativeOptions?.music||[]).map(t=>({value:t.id,label:t.title}))]]){el(id).replaceChildren(...options.map(item=>{const o=document.createElement('option');o.value=item.value;o.textContent=item.label;return o;}));}
const names={yugi:'Yugi',kaiba:'Kaiba',jonouchi:'Joey / Jonouchi'};
for(const id of Object.keys(config.characters)){const o=document.createElement('option');o.value=id;o.textContent=names[id]||id;character.append(o);}
const skinMemoryKey='yfm_online_skin_choices_v1';let skinMemory={};try{skinMemory=JSON.parse(localStorage.getItem(skinMemoryKey)||'{}');}catch{}if(!skinMemory||typeof skinMemory!=='object'||Array.isArray(skinMemory))skinMemory={};
function skins(){const remembered=Number(skinMemory[character.value]);skin.replaceChildren();for(const id of config.characters[character.value]){const o=document.createElement('option');o.value=id;o.textContent='Slot '+(id+1);skin.append(o);}if(config.characters[character.value].includes(remembered))skin.value=String(remembered);}
skin.addEventListener('change',()=>{skinMemory[character.value]=Number(skin.value);try{localStorage.setItem(skinMemoryKey,JSON.stringify(skinMemory));}catch{}});
character.onchange=skins;skins();
const invite=new URL(location.href).searchParams.get('room');if(invite)el('code').value=invite;
const selection=()=>({character:character.value,skin:Number(skin.value),preset:el('deck').value,music:Number(el('duel-music').value),lifePoints:Number(el('life-points').value),name:el('name').value});
for(const control of [character,skin,el('deck'),el('duel-music'),el('life-points'),el('name')])control.addEventListener('change',()=>{if(roomCode){send({type:'SELECT',selection:selection()});el('status').textContent='Selección actualizada';}});

const ws=new WebSocket('wss://yfm-duel-online.phdigital.workers.dev/online-v1');
const send=m=>{if(ws.readyState===1)ws.send(JSON.stringify(m));};
let iframe,loadResolve,stepResolve,currentHash='0'.repeat(64),keys=0,frameKeys=0,session,index;
let roomCode=null,networkState='waiting',meterTime=0,meterTick=0;
let searchStarted=0,foundAnnounced=false,reconnectUntil=0;
setInterval(()=>{const node=document.getElementById('reconnect-timer');if(node)node.textContent=String(Math.max(0,Math.ceil((reconnectUntil-performance.now())/1000))).padStart(2,'0')+' s';},250);
const found=document.createElement('section');found.className='match-found';found.hidden=true;found.setAttribute('role','dialog');found.setAttribute('aria-label','Rival encontrado');found.innerHTML='<div><span class="eyebrow">DUELO ONLINE</span><h2>¡Rival encontrado!</h2><p id="match-pair"></p><p id="match-hint">Tu duelista y tu mazo están preparados.</p><button id="match-fight">A luchar</button><button id="match-back" class="secondary">Volver a la sala</button></div>';el('player-stage').append(found);
const foundSound=new Audio('menu-assets/fm-menu-confirm.wav');foundSound.volume=.6;
el('match-fight').onclick=()=>{send({type:'READY',ready:true});el('match-fight').disabled=true;el('match-hint').textContent='¡Listo! Esperando la confirmación del rival…';};
el('match-back').onclick=()=>{found.hidden=true;};
setInterval(()=>{if(searchStarted){const seconds=Math.floor((Date.now()-searchStarted)/1000);el('find').textContent='Buscando rival · '+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}},250);
function stopSearch(){searchStarted=0;el('find').textContent='Buscar rival casual';}

const savedKey='yfm_online_test_seat_v1';
function readSeat(){try{return JSON.parse(sessionStorage.getItem(savedKey));}catch{return null;}}
function clearSeat(){sessionStorage.removeItem(savedKey);}
function visibility(){keys=frameKeys=0;send({type:'VISIBILITY',visible:!document.hidden});}
document.addEventListener('visibilitychange',visibility);
function showPause(text){
  el('notice').textContent=text;
  let cover=document.getElementById('pause-cover');
  if(!cover){cover=document.createElement('div');cover.id='pause-cover';cover.className='connection-cover';el('runtime').append(cover);}
  cover.replaceChildren();const card=document.createElement('div');const title=document.createElement('h2');title.textContent='Duelo en pausa';const detail=document.createElement('p');detail.textContent=text;card.append(title,detail);cover.append(card);
}
function clearPause(){el('notice').textContent='';document.getElementById('pause-cover')?.remove();}
const mapping={ArrowUp:0x10,ArrowRight:0x20,ArrowDown:0x40,ArrowLeft:0x80,
  KeyX:0x4000,KeyS:0x2000,KeyA:0x1000,KeyZ:0x8000,KeyQ:0x400,KeyW:0x800,Enter:8};
for(const kind of ['keydown','keyup'])addEventListener(kind,e=>{
  if(['INPUT','SELECT'].includes(e.target.tagName))return;
  const bit=mapping[e.code];if(!bit)return;e.preventDefault();
  keys=kind==='keydown'?keys|bit:keys&~bit;
});
addEventListener('blur',()=>{keys=0;});
function pad(){
  let p=keys|frameKeys;const gp=navigator.getGamepads?.()[0];
  if(gp){const bits={0:0x4000,1:0x2000,2:0x8000,3:0x1000,4:0x400,5:0x800,8:1,9:8,12:0x10,13:0x40,14:0x80,15:0x20};
    for(const [button,bit]of Object.entries(bits))if(gp.buttons[button]?.pressed)p|=bit;}
  return p;
}
const engine={isolatedOnline:true,
  prepare:manifest=>new Promise(resolve=>{
    loadResolve=resolve;iframe=document.createElement('iframe');iframe.src='runtime.html?v=privacy81';
    iframe.title='Duelo online aislado';el('runtime').replaceChildren(iframe);
    iframe.manifest=manifest;
  }),
  step:(pads,tick)=>new Promise(resolve=>{stepResolve=resolve;iframe.contentWindow.postMessage({online:true,type:'FRAME',pads,tick},location.origin);}),
  checksum:async()=>currentHash,
  pause:()=>{iframe?.contentWindow.postMessage({online:true,type:'STOP'},location.origin);el('status').textContent='Duelo pausado';if(networkState!=='paused')showPause('El duelo está detenido. Puedes volver a la sala para preparar una nueva partida.');}
};
function newController(){session=new OnlineEngineSession({engine,send,readPad:pad,onState:s=>{
  if(s==='playing'&&networkState==='playing'){
    const now=performance.now();
    if(now-meterTime>=500){
      const rate=meterTime?((session.tick-meterTick)*1000/(now-meterTime)).toFixed(1):'…';
      el('status').textContent=`Duelo en marcha · jugador ${index+1} · paso ${session.tick} · ${rate} pasos/s`;
      meterTime=now;meterTick=session.tick;
    }
  }
}});}
function setPlayerMode(mode){
 if(parent!==window)parent.postMessage({onlineShell:true,type:'MODE',mode},location.origin);
 document.querySelector('.player-heading h1').textContent=mode==='playing'?'Duelo en curso':mode==='loading'?'Preparando el duelo':'OPCIONES DE DUELO ONLINE';
 el('online-lobby').hidden=mode!=='lobby';el('runtime').hidden=mode==='lobby';el('loading-panel').hidden=mode!=='loading';
 el('player-stage').classList.toggle('is-playing',mode==='playing');el('player-stage').classList.toggle('is-loading',mode==='loading');
}
function resetRuntime(reason){
 if(iframe&&!document.querySelector('.return-transition')){const cover=document.createElement('div');cover.className='return-transition';cover.innerHTML='<span class="eyebrow">DUELO FINALIZADO</span><h2>Volviendo a la sala</h2>';el('player-stage').append(cover);setTimeout(()=>{iframe?.remove();iframe=null;cover.remove();resetRuntime(reason);},450);return;}

 setPlayerMode('lobby');found.hidden=true;stopSearch();

  session?.stop();iframe?.remove();iframe=null;loadResolve=stepResolve=null;keys=frameKeys=0;
  el('runtime').replaceChildren();clearPause();newController();
  meterTime=0;meterTick=0;
  el('select').disabled=el('ready').disabled=false;el('status').textContent=reason;log(reason);
}
newController();
addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==iframe?.contentWindow||!e.data?.online)return;
  const m=e.data;
  if(m.type==='RUNTIME_READY')iframe.contentWindow.postMessage({online:true,type:'INIT',manifest:iframe.manifest,playerIndex:index},location.origin);
  if(m.type==='PROGRESS'){el('status').textContent=`${m.text} · ${m.done} / ${m.total}`;el('loading-text').textContent=m.text;}
  if(m.type==='RESULTS'){el('notice').textContent='Resultados del duelo: pulsa la flecha abajo para volver a la sala.';}
  if(m.type==='FINISH'){send({type:'FINISH',tick:m.tick,winner:m.winner});el('status').textContent='Confirmando resultado…';}
  if(m.type==='LOADED'){loadResolve?.();loadResolve=null;}
  if(m.type==='STEPPED'){if(m.hash)currentHash=m.hash;stepResolve?.();stepResolve=null;}
  if(m.type==='PAD')frameKeys=m.pad;
  if(m.type==='ERROR'){log(m.message);session.stop('error');send({type:'RESET'});}
});
ws.addEventListener('open',()=>{
  el('create').disabled=el('join').disabled=el('find').disabled=false;
  const saved=readSeat();
  if(saved){el('status').textContent='Recuperando sala…';send({type:'RESUME',...saved,build:config.build});}
  else el('status').textContent='Conectado. Crea una sala o entra con su código.';
});
ws.addEventListener('message',async e=>{
  const m=JSON.parse(e.data);
  try{
    if(m.type==='SEARCHING'){searchStarted=Date.now();foundAnnounced=false;el('status').textContent='Buscando rival…';el('cancel-search').hidden=false;el('create').disabled=el('join').disabled=el('find').disabled=true;}
    if(m.type==='SEARCH_CANCELLED'){stopSearch();el('cancel-search').hidden=true;el('create').disabled=el('join').disabled=el('find').disabled=false;el('status').textContent='Busqueda cancelada';}
    if(m.type==='JOINED'){stopSearch();foundAnnounced=false;
      el('cancel-search').hidden=true;el('find').disabled=true;
      const inviteUrl=new URL(location.href);if(parent!==window){inviteUrl.pathname='/';inviteUrl.search='?online=1';}inviteUrl.searchParams.set('room',m.code);el('invite').value=inviteUrl.href;el('invite-row').hidden=false;

      roomCode=m.code;sessionStorage.setItem(savedKey,JSON.stringify({code:m.code,token:m.token}));
      el('reset').disabled=el('leave').disabled=false;
      index=m.index;el('life-points').disabled=index!==0;el('code').value=m.code;el('create').disabled=el('join').disabled=true;
      el('select').disabled=false;el('status').textContent=`Sala ${m.code} · jugador ${index+1}`;
      log(`Comparte el código ${m.code} con la segunda pestaña.`);
      visibility();send({type:'SELECT',selection:selection()});
    }
    if(m.type==='STATE'){
      networkState=m.state;if(m.state==='paused'&&m.reconnectRemainingMs!==null){reconnectUntil=performance.now()+m.reconnectRemainingMs;showPause('El rival perdió la conexión. Esperaremos hasta 60 segundos. Si no regresa, ganarás por abandono.');const counter=document.createElement('div');counter.id='reconnect-timer';counter.className='connection-countdown';document.querySelector('#pause-cover>div').append(counter);}
      if(m.startingLifePoints!==undefined&&index!==0)el('life-points').value=String(m.startingLifePoints);
      if(m.state==='waiting'){
 const both=m.players.filter(p=>p?.selection&&p.connected).length===2;
 el('match-fight').disabled=!both||!!m.players[index]?.ready;
 el('ready').disabled=!both||!!m.players[index]?.ready;
 el('ready').textContent='A luchar';
 el('status').textContent=both?(m.players[index]?.ready?'Listo. Esperando al rival…':'Rival encontrado. Pulsa A luchar.'):'Sala preparada. Invita a tu rival con el enlace.';
 if(both&&!foundAnnounced){foundAnnounced=true;found.hidden=false;el('match-pair').textContent=m.players.map(p=>p.name).join('  VS  ');el('match-fight').disabled=false;el('match-hint').textContent='Tu duelista y tu mazo están preparados.';foundSound.currentTime=0;foundSound.play().catch(()=>{});el('match-fight').focus();}
 if(!both){found.hidden=true;foundAnnounced=false;}
 }else{found.hidden=true;}

      el('players').textContent=m.players.map((p,i)=>p?`J${i+1}: ${p.name} · ${p.ready?'Listo':p.selection?'Mazo confirmado':'Eligiendo'}`:`J${i+1}: esperando`).join(' | ');
      if(m.state==='loading'){setPlayerMode('loading');el('select').disabled=el('ready').disabled=true;el('status').textContent='Cargando motores…';}
      if(m.state==='suspended'){el('status').textContent='Pausado: una pestaña está oculta';showPause('Pausa compartida al ocultar una pestaña. Usa dos ventanas visibles o dos equipos. Se reanuda cuando ambas estén visibles.');}
      if(m.state==='playing'){setPlayerMode('playing');clearPause();}
    }
    if(m.type==='FINISHED'){if(m.reason){showPause(m.winner===index?'Victoria por abandono del rival.':'Duelo finalizado por desconexión.');setTimeout(()=>resetRuntime(m.winner===index?'Ganaste por abandono. Puedes buscar otro rival.':'Duelo finalizado por desconexión.'),1800);}else resetRuntime(m.winner===index?'Ganaste el duelo. Puedes preparar otra partida.':'El rival ganó el duelo. Puedes preparar otra partida.');return;}
    if(m.type==='RESET'){resetRuntime(m.reason);visibility();return;}
    if(m.type==='LEFT'){el('life-points').disabled=false;el('find').disabled=false;el('invite-row').hidden=true;clearSeat();roomCode=null;resetRuntime('Saliste de la sala. Crea una nueva o entra con otro código.');el('create').disabled=el('join').disabled=false;el('select').disabled=el('ready').disabled=el('reset').disabled=el('leave').disabled=true;return;}
    if(m.type==='ERROR'){log(m.message);if(!roomCode){clearSeat();el('status').textContent=m.message+'. Puedes crear una sala nueva.';}}
    await session.receive(m);
  }catch(error){log(error.message);session.stop('error');}
});
ws.addEventListener('close',()=>{stopSearch();found.hidden=true;log('Conexión cerrada.');session.stop();showPause('Se perdió tu conexión. Puedes recuperar la sala durante los próximos 60 segundos. Recuperar la sala reinicia la preparación del duelo.');const card=document.querySelector('#pause-cover>div');const button=document.createElement('button');button.textContent='Recuperar sala';button.onclick=()=>location.reload();card.append(button);});
el('create').onclick=()=>send({type:'CREATE',protocol:config.protocol,build:config.build,name:el('name').value});
el('join').onclick=()=>send({type:'JOIN',protocol:config.protocol,build:config.build,name:el('name').value,code:el('code').value});
el('select').onclick=()=>{send({type:'SELECT',selection:selection()});el('ready').disabled=false;};
el('ready').onclick=()=>{el('match-fight').click();found.hidden=false;};
el('reset').onclick=()=>send({type:'RESET'});
el('leave').onclick=()=>send({type:'LEAVE'});

el('find').onclick=()=>send({type:'FIND',protocol:config.protocol,build:config.build,name:el('name').value,selection:{...selection(),lifePoints:8000}});
el('cancel-search').onclick=()=>send({type:'CANCEL_SEARCH'});
el('copy-invite').onclick=async()=>{try{await navigator.clipboard.writeText(el('invite').value);el('notice').textContent='Invitacion copiada';}catch{el('invite').select();el('notice').textContent='Copia el enlace seleccionado';}};

if(parent!==window){const back=document.createElement('button');back.id='back-to-home';back.textContent='Volver';back.onclick=()=>parent.postMessage({onlineShell:true,type:'EXIT'},location.origin);document.querySelector('.player-heading').append(back);}
