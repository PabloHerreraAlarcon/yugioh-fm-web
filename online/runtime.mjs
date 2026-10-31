import {createDeferredIO} from '/online-assets/deferred-io.js';
import {prepareNativeMods} from '/online-assets/native-mods-online.js';
import {OnlineViewPolicy} from './view-policy.mjs';
// Experimental runtime: new iframe + MEMFS only. Never imports campaign persistence.
const notify = (type, detail={}) => parent.postMessage({online:true,type,...detail},location.origin);
let gate=null, completion=null, expected=0, initialized=false, stopped=false;
let paceBase=null;
let keys=0;
const bits={ArrowUp:0x10,ArrowRight:0x20,ArrowDown:0x40,ArrowLeft:0x80,KeyX:0x4000,
  KeyS:0x2000,KeyA:0x1000,KeyZ:0x8000,KeyQ:0x400,KeyW:0x800,Enter:8};
for(const kind of ['keydown','keyup'])addEventListener(kind,e=>{
  if(!bits[e.code])return;e.preventDefault();keys=kind==='keydown'?keys|bits[e.code]:keys&~bits[e.code];
  notify('PAD',{pad:keys});
});
addEventListener('blur',()=>{keys=0;notify('PAD',{pad:0});});
const fail=e=>{stopped=true;notify('ERROR',{message:String(e?.message||e)});};
window.addEventListener('error',e=>fail(e.error||e.message));
window.addEventListener('unhandledrejection',e=>fail(e.reason));
document.getElementById('canvas').addEventListener('webglcontextlost',e=>{
  e.preventDefault();fail('Se perdiÃ³ el contexto grÃ¡fico. Se reiniciarÃ¡ la sala para evitar una pantalla blanca.');
});
window.addEventListener('message',async e=>{
  if(e.origin!==location.origin || e.source!==parent || !e.data?.online) return;
  const m=e.data;
  try {
    if(m.type==='INIT') {
      if(initialized) throw Error('Runtime ya inicializado');
      initialized=true;
      const policy=new OnlineViewPolicy(m.playerIndex);
      const manifest=m.manifest;
      if(manifest.players.length!==2 || manifest.players.some(p=>p.deck.length!==40)) throw Error('Mazos invÃ¡lidos');
      if(!manifest.content?.mods?.includes('anime-duel-cutins'))throw Error('Falta el perfil de mods online');
      const io=await createDeferredIO();
      notify('PROGRESS',{text:'Preparando el disco del duelo',done:0,total:1});
      await io.warmBoot();
      const nativeMods=await prepareNativeMods((loaded,total,stage)=>notify('PROGRESS',{text:'Preparando mods',done:stage?.processed||0,total:stage?.files||1}),manifest.content);
      const chars={yugi:0,kaiba:1,jonouchi:2};
      const settings=manifest.players.flatMap((p,i)=>[
        'mod.anime-duel-cutins.free_duel_character'+(i?'_p2':'')+'='+chars[p.character],
        'mod.anime-duel-cutins.free_duel_skin_p'+(i+1)+'='+p.skin
      ]);
      manifest.content.settings=[...manifest.content.settings,...settings];
      const fontBytes=await Promise.all(['/assets/ui/Montserrat.ttf','/assets/ui/Tinos-Regular.ttf'].map(async path=>{const response=await fetch(path);if(!response.ok)throw Error('No se pudo cargar la tipografia');return new Uint8Array(await response.arrayBuffer());}));
      const names=new Set(manifest.players.map(p=>p.character));
      const warmPaths=nativeMods.files.filter(f=>f.path.includes('/anime-duel-cutins/')&&[...names].some(name=>f.path.includes('/'+name+'/')||f.path.includes('/'+name+'_'))&&!/_(720|800|960)x/.test(f.path)).map(f=>f.path);
      const selectedMusic=manifest.rules.musicTracks?.find(t=>t.id===(manifest.players[m.playerIndex].music??0));if(selectedMusic?.file)warmPaths.push('/mods/anime-duel-cutins/'+selectedMusic.file);
      const payload=new Uint8Array(164),view=new DataView(payload.buffer);
      view.setUint32(0,manifest.seed,true);
      manifest.players.flatMap(p=>p.deck).forEach((id,i)=>view.setUint16(4+i*2,id,true));
      window.Module={canvas:document.getElementById('canvas'),noInitialRun:true,
        onlinePresentation(){
          const words=Array.from({length:6},(_,i)=>window.Module._WebOnline_StateWord(i));
          const state=policy.update(words),canvas=document.getElementById('canvas'),cover=document.getElementById('private-view');
          const inGame=state.visible;
          canvas.style.visibility=inGame?'visible':'hidden';
          cover.style.display=inGame?'none':'grid';
          const rival=words[2]!==m.playerIndex;
          const results=(words[3]&15)>=12;
          if(results&&!window.Module.resultNotified){window.Module.resultNotified=true;notify('RESULTS',{winner:window.Module._WebOnline_ViewWord?.(2)});}
          document.getElementById('private-label').hidden=true;
          const viewer=window.Module._WebOnline_ViewWord?.(1)||0;
          document.getElementById('private-detail').hidden=!inGame||results||!state.privateDetails||!viewer;
          const text=inGame?`Tus LP: ${state.lp[m.playerIndex]} · Rival: ${state.lp[1-m.playerIndex]}`:'Preparando la mesa, las voces y tus cartas';
          if(document.getElementById('turn').textContent!==state.text)document.getElementById('turn').textContent=state.text;
          if(document.getElementById('life').textContent!==text)document.getElementById('life').textContent=text;
        },
        locateFile:name=>'/online-engine75/'+name,
        preRun:[module=>{io.mountDisc(module);nativeMods.mount(module);module.FS.mkdirTree('/game/fonts');module.FS.writeFile('/game/fonts/interface.ttf',fontBytes[0]);module.FS.writeFile('/game/fonts/serif.ttf',fontBytes[1]);Object.assign(module.ENV,nativeMods.env,{
          MEMORIES_ONLINE_NAME_P1:manifest.players[0].name,MEMORIES_ONLINE_NAME_P2:manifest.players[1].name,MEMORIES_ONLINE_LP:String(manifest.rules.startingLifePoints||8000),MEMORIES_ONLINE_MUSIC:String(manifest.players[m.playerIndex].music??0),MEMORIES_ONLINE_SEAT:String(m.playerIndex),MEMORIES_DISC:'/game/yfm.bin',MEMORIES_DETERMINISTIC:'1',MEMORIES_SPEED:'-1',
          MEMORIES_NO_MONITOR:'1',MEMORIES_BENCHMARK_TWO_PLAYER:'1',MEMORIES_ONLINE_FIXTURE:'1',
          MEMORIES_USER_DIR:'/game/online-user',MEMORIES_SETTINGS:'/game/settings.cfg',
          MEMORIES_MEMCARD1:'/game/unused-online-1.mcd',MEMORIES_MEMCARD2:'/game/unused-online-2.mcd',
          MEMORIES_ASPECT:'0',MEMORIES_OPPONENT_NAME:'1',MEMORIES_GLES:'1',MEMORIES_INTERNAL_SCALE:'4',MEMORIES_HD_TEXT:'1',MEMORIES_MENU_BAR:'0',MEMORIES_UI_FONT:'/game/fonts/interface.ttf',MEMORIES_SERIF_FONT:'/game/fonts/serif.ttf'
        });}],
        print:t=>console.log('[online]',t),printErr:t=>console.warn('[online]',t),
        onAbort:reason=>fail(reason),
        onlineWait:async tick=>{
          if(stopped) return new Promise(()=>{});
          if(window.Module.onlineResultWinner!==undefined){notify('FINISH',{tick,winner:window.Module.onlineResultWinner});return new Promise(()=>{});}
          if(tick!==expected) throw Error('Reloj del motor fuera de secuencia');
          if(completion){ const done=completion;completion=null;done(); }
          if(tick===0){await window.Module.yfmPrefetch(warmPaths,(done,total)=>notify('PROGRESS',{text:'Preparando personajes y voces',done,total}));}
          return new Promise(resolve=>{
            gate={tick,resolve};
            if(tick===0) notify('LOADED',{hash:manifest.hash});
          });
        },
        onRuntimeInitialized(){
          const mod=window.Module;
          mod.FS.mkdirTree('/game');
          mod.FS.writeFile('/game/online-session.bin',payload);
          mod.callMain([]);
        }
      };
      const script=document.createElement('script');script.src='/online-engine75/memories-pc.js';
      script.onerror=()=>fail('No se pudo cargar el motor experimental');document.body.append(script);
    } else if(m.type==='FRAME') {
      if(stopped || !gate || gate.tick!==m.tick || completion) throw Error('El motor no esperaba este cuadro');
      // One pacing owner. Never let runtime pacing and network round-trips add
      // their delays. A long pause rebases real time without skipping game ticks.
      const now=performance.now();
      if(paceBase===null||now-(paceBase+m.tick*1000/60)>250)paceBase=now-m.tick*1000/60;
      const wait=paceBase+m.tick*1000/60-now;
      if(wait>1)await new Promise(resolve=>setTimeout(resolve,wait));
      if(stopped)return;
      const current=gate;gate=null;expected++;
      await new Promise(resolve=>{completion=resolve;current.resolve((m.pads[0]|(m.pads[1]<<16))>>>0);});
      // Read only at an Asyncify network barrier: simulation is paused here.
      if((m.tick+1)%120===0){
        const words=new Uint32Array(6);
        for(let i=0;i<6;i++) words[i]=window.Module._WebOnline_StateWord(i);
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',words.buffer)))
          .map(x=>x.toString(16).padStart(2,'0')).join('');
        notify('STEPPED',{tick:m.tick,hash,words:[...words]});
      }else notify('STEPPED',{tick:m.tick});
    } else if(m.type==='STOP') {stopped=true;}
  }catch(error){fail(error);}
});
notify('RUNTIME_READY');
