let authorization='';
async function credentials(){if(authorization)return authorization;const password=await new Promise(resolve=>{const dialog=document.createElement('dialog');dialog.style.cssText='border:1px solid #2c4053;border-radius:14px;padding:24px;background:#0b2235;color:#f9f8f8;max-width:360px;font:13px Arial';dialog.innerHTML='<form method="dialog"><h3>Prueba de disco segmentado</h3><p>Acceso privado · Usuario tester</p><label>Contraseña <input type="password" autocomplete="off" required style="display:block;width:100%;box-sizing:border-box;padding:10px;margin:10px 0"></label><button value="enter">Continuar</button> <button value="cancel" formnovalidate>Cancelar</button></form>';document.body.append(dialog);dialog.addEventListener('close',()=>{const value=dialog.returnValue==='enter'?dialog.querySelector('input').value:'';dialog.remove();resolve(value);},{once:true});dialog.showModal();dialog.querySelector('input').focus();});if(!password)throw Error('Prueba privada cancelada.');authorization='Basic '+btoa('tester:'+password);return authorization;}
export async function loadSegmentedDisc(progress){
 const auth=await credentials();
 async function remote(path){const response=await fetch('https://yfm-private-disc-test.phdigital.workers.dev'+path,{credentials:'omit',headers:{Authorization:auth}});if(response.status===401){authorization='';throw Error('Contraseña incorrecta. Vuelve a iniciar la prueba.');}return response;}

 const start=performance.now();const response=await remote('/disc/manifest.json');if(!response.ok)throw Error('No se pudo obtener el manifiesto del disco');const manifest=await response.json();
 if(manifest.size!==517872768 || !Array.isArray(manifest.parts) || manifest.parts.length!==31)throw Error('Manifiesto de disco no válido');
 const bytes=new Uint8Array(manifest.size);let downloaded=0,fromCache=0,network=0,next=0;let cache=null;try{cache=await caches.open('yfm-production-test-disc-'+manifest.sha256);}catch{}
 const hex=buffer=>Array.from(new Uint8Array(buffer)).map(x=>x.toString(16).padStart(2,'0')).join('');
 const timings=[];
 async function worker(){while(next<manifest.parts.length){const p=manifest.parts[next++];if(!/^\/disc\/part-\d{3}\.bin$/.test(p.path)||p.size>16777216||p.offset<0||p.offset+p.size>bytes.length)throw Error('Fragmento no válido');let hit=cache?await cache.match(p.path):null;let block=hit?await hit.arrayBuffer():null;let cached=!!block;const t=performance.now();
 if(block && (block.byteLength!==p.size || hex(await crypto.subtle.digest('SHA-256',block))!==p.sha256)){await cache.delete(p.path);block=null;cached=false;}
 if(!block){let last;for(let attempt=0;attempt<3;attempt++){try{const r=await remote(p.path);if(!r.ok)throw Error('HTTP '+r.status);block=await r.arrayBuffer();if(block.byteLength!==p.size || hex(await crypto.subtle.digest('SHA-256',block))!==p.sha256)throw Error('Integridad incorrecta');last=null;break;}catch(e){last=e;}}if(last)throw last;if(cache)try{await cache.put(p.path,new Response(block));}catch{}network+=p.size;}else fromCache+=p.size;
 bytes.set(new Uint8Array(block),p.offset);downloaded+=p.size;timings.push({part:p.path,ms:Math.round(performance.now()-t),cached});progress(downloaded,manifest.size);}}
 await Promise.all([worker(),worker()]);
 const report={source:'private-segmented-web',size:manifest.size,parts:manifest.parts.length,sha256:manifest.sha256,downloadMs:Math.round(performance.now()-start),networkBytes:network,cachedBytes:fromCache,timings};
 window.yfmDiscTestReport=report;console.info('Disco experimental',report);try{localStorage.setItem('yfm_private_disc_last_report',JSON.stringify(report));}catch{}
 let button=document.getElementById('disc-test-report');if(!button){button=document.createElement('button');button.id='disc-test-report';button.type='button';button.className='btn btn-stone';button.textContent='Descargar informe del disco';document.getElementById('tab-general')?.append(button);}
 button.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(window.yfmDiscTestReport,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='yfm-disco-segmentado.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return bytes.buffer;
}
