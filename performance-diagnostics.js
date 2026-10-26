// Opt-in, local-only diagnostics. Never collect raw logs, disc data or saves.
export function parsePerformanceLine(text){
 const prefix=String(text).match(/\[t (\d+) us frame (\d+) vb (\d+) frames\] (.*)/);if(!prefix)return null;
 const base={engineUs:Number(prefix[1]),frame:Number(prefix[2]),vblank:Number(prefix[3])},line=prefix[4];
 let m=line.match(/^game (\d+) us, present (\d+) us per frame \(max (\d+), (\d+)\); (\d+) VBlanks missed in 120 frames/);
 if(m)return {...base,type:'timing',gameUs:+m[1],presentUs:+m[2],gameMaxUs:+m[3],presentMaxUs:+m[4],missedVblanks:+m[5]};
 m=line.match(/^clocks: rate (-?\d+), ([\d.]+) game frames\/s, ([\d.]+) shown\/s, ([\d.]+) VBlanks\/s, ([\d.]+) sequencer ticks\/s/);
 return m?{...base,type:'clocks',rate:+m[1],gameFramesPerSecond:+m[2],shownPerSecond:+m[3],vblanksPerSecond:+m[4],sequencerTicksPerSecond:+m[5]}:null;
}
export function createPerformanceDiagnostics(getModule){
 const enabled=new URLSearchParams(location.search).get('performance')==='1';let records=[],epochs=0,meta={},status,download;
 function record(text){if(!enabled||document.hidden)return;const entry=parsePerformanceLine(text);if(!entry)return;records.push({...entry,epoch:epochs});if(records.length>600)records.shift();if(download)download.disabled=false;
  if(status){const t=[...records].reverse().find(x=>x.type==='timing'&&x.epoch===epochs),c=entry.type==='clocks'?entry:null;status.textContent=`${records.length} muestras${t?` · Cálculo ${(t.gameUs/1000).toFixed(1)} ms · Presentación y espera ${(t.presentUs/1000).toFixed(1)} ms`:''}${c?` · ${c.gameFramesPerSecond.toFixed(1)} cuadros/s`:''}`;}}
 function setup(){const panel=document.getElementById('tab-graphics');if(!panel)return;const box=document.createElement('details');box.className='gamepad-panel';box.innerHTML='<summary>Diagnóstico de rendimiento</summary><p>Recoge tiempos locales del motor. No incluye tu disco ni partidas y no envía datos a un servidor.</p>';panel.append(box);
  if(!enabled){const a=document.createElement('a');const url=new URL(location.href);url.searchParams.set('performance','1');a.href=url.href;a.className='btn btn-stone';a.textContent='Abrir con diagnóstico';a.addEventListener('click',e=>{if(!confirm('La página se volverá a abrir. Guarda tu partida antes de continuar. ¿Abrir el diagnóstico?'))e.preventDefault();});box.append(a);return;}
  box.open=true;status=document.createElement('p');status.setAttribute('role','status');status.textContent='Inicia el juego y juega un duelo durante un minuto.';download=document.createElement('button');download.className='btn btn-stone';download.textContent='Descargar reporte';download.disabled=true;box.append(status,download);
  const note=document.createElement('p');note.textContent='Presentación incluye esperas del navegador; no es tiempo puro de GPU. La captura añade un pequeño coste. Para salir del diagnóstico, quita ?performance=1 de la dirección.';box.append(note);
  download.onclick=()=>{const module=getModule();const settings={};for(const [key,index]of [['scale',3],['aspect',4],['filter',5]])if(typeof module?._YfmWeb_GetSetting==='function')settings[key]=module._YfmWeb_GetSetting(index);
   const report={schema:1,kind:'yfm-local-performance',capturedAt:new Date().toISOString(),settings,mods:meta,wasmHeapBytes:module?.HEAPU8?.byteLength??null,records,limitations:['Presentation includes browser suspension.','Counts are not a percentage of game simulation speed.','Hidden-tab samples are excluded; epochs separate visibility changes.','Wasm heap capacity is not total memory usage.','Diagnostic tracing adds overhead.']};
   const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='yfm-rendimiento.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 }
 document.addEventListener('visibilitychange',()=>{epochs++;});
 return {enabled,record,setup,configure(env){meta=Object.fromEntries(Object.entries(env).filter(([k,v])=>/^MEMORIES_MOD_[A-Z0-9_]+$/.test(k)&&['0','1'].includes(String(v))));}};
}
