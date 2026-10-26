// Manual placements only. Fill slot IDs from AdSense after approval.
(()=>{
 const layout=document.querySelector('.approved-play-layout');
 const game=document.querySelector('.game-viewport-section');
 const ranking=document.querySelector('.reference-ranking');
 if(!layout||!game||!ranking)return;
 const rail=document.createElement('div');rail.className='sponsor-rail';ranking.before(rail);rail.append(ranking);
 function placement(id,kind){const box=document.createElement('aside');box.className='sponsor-placement sponsor-'+kind;box.dataset.placement=id;box.setAttribute('aria-label','Publicidad');box.innerHTML='<span class="sponsor-label">PUBLICIDAD</span><div class="sponsor-content"><span class="sponsor-placeholder">Espacio publicitario</span></div>';return box;}
 rail.append(placement('sidebar','side'));game.append(placement('below-player','bottom'));
 // No ad requests or timers until approved real ad-unit IDs are supplied.
})();
