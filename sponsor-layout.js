// Own-project promotion; no advertising SDK, cookies or remote images.
(()=>{
 const layout=document.querySelector('.approved-play-layout'),game=document.querySelector('.game-viewport-section'),ranking=document.querySelector('.reference-ranking');
 if(!layout||!game||!ranking)return;
 const rail=document.createElement('div');rail.className='sponsor-rail';ranking.before(rail);rail.append(ranking);
 function promo(kind){const box=document.createElement('aside');box.className='patreon-promo patreon-'+kind;box.setAttribute('aria-label','Apoya TP7 Projects');box.innerHTML='<a href="https://www.patreon.com/cw/tp7projects" target="_blank" rel="noopener noreferrer"><img src="/assets/ui/yugi.png" alt="" loading="lazy" decoding="async" width="512" height="512"><div class="patreon-promo-copy"><span class="patreon-kicker">TP7 PROJECTS · PATREON</span><strong>El próximo duelo<br>lo creamos juntos.</strong><p>Apoya el desarrollo de Anime Duel Cutins.</p><span class="patreon-cta">Conoce el Patreon <b aria-hidden="true">↗</b></span></div></a></aside>';return box;}
 rail.append(promo('side'));game.append(promo('bottom'));
})();
