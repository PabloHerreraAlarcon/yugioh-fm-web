const $=id=>document.getElementById(id),character=$('character'),skin=$('skin');
const data={yugi:{name:'Yugi',color:'#8b69ed',art:['yugi_cutin_960x960.png','yugi_skin2_cutin_960x960.png','yugi_skin3_cutin_960x960.png'],thumb:['avatar_00','avatar_00_skin1','avatar_00_skin2']},kaiba:{name:'Kaiba',color:'#55b4ec',art:['@kaiba-fm-slot1.png','kaiba_skin2_cutin_960x960.png','kaiba_cutin_960x960.png'],thumb:['avatar_17','avatar_17_skin1','avatar_17_skin2']},jonouchi:{name:'Joey / Jonouchi',color:'#e6a648',art:['jonouchi_green_cutin_960x960.png','jonouchi_cutin_960x960.png','jonouchi_skin3_cutin_960x960.png'],thumb:['avatar_19_skin1','avatar_03_skin1','avatar_03_skin2']}};
let last='';
function choose(select,value){if(select.disabled)return;select.value=String(value);select.dispatchEvent(new Event('change',{bubbles:true}));}
function preview(){if(!character.options.length||!skin.options.length)return;const id=character.value,d=data[id],slot=Number(skin.value)||0,key=id+':'+slot;
 $('character-cards').replaceChildren(...[...character.options].map(o=>{const button=document.createElement('button');button.type='button';button.className='duelist-choice';button.setAttribute('aria-pressed',String(o.value===id));const img=document.createElement('img');img.src='menu-assets/'+data[o.value].thumb[0]+'.png';img.alt='';const text=document.createElement('span');text.textContent=data[o.value].name;button.append(img,text);button.title='Elegir a '+data[o.value].name;button.onclick=()=>choose(character,o.value);return button;}));
 for(const locked of [{name:'Mai Valentine',file:'portraits-11-mai-valentine.png'},{name:'Pegasus',file:'portraits-15-pegasus.png'},{name:'Teana',file:'portraits-02-teana.png'}]){const button=document.createElement('button');button.type='button';button.className='duelist-choice is-locked';button.disabled=true;button.setAttribute('aria-label',locked.name+' · Próximamente');const img=document.createElement('img');img.src='/assets/cards-hd/'+locked.file;img.alt='';const label=document.createElement('span');label.textContent=locked.name;const badge=document.createElement('small');badge.textContent='PRÓXIMAMENTE';button.append(img,label,badge);$('character-cards').append(button);}
 $('skin-cards').replaceChildren(...[...skin.options].map(o=>{const n=Number(o.value),button=document.createElement('button');button.type='button';button.className='skin-choice';button.setAttribute('aria-pressed',String(n===slot));const img=document.createElement('img');img.src='menu-assets/'+d.thumb[n]+'.png';img.alt='';const text=document.createElement('span');text.textContent='Slot '+(n+1);button.append(img,text);button.onclick=()=>choose(skin,n);return button;}));
 $('skin-count').textContent=String(slot+1).padStart(2,'0')+' / '+String(skin.options.length).padStart(2,'0');
 if(last!==key){last=key;const hero=$('duelist-portrait');hero.classList.remove('portrait-enter');hero.src=d.art[slot]?.startsWith('@')?'menu-assets/'+d.art[slot].slice(1):d.art[slot]?'/assets/cutins/'+d.art[slot]:'menu-assets/'+d.thumb[slot]+'.png';hero.classList.toggle('portrait-fallback',!d.art[slot]);hero.alt=d.name+' · Slot '+(slot+1);hero.onload=()=>hero.classList.add('portrait-enter');$('portrait-name').textContent=d.name;$('portrait-slot').textContent='ASPECTO '+String(slot+1).padStart(2,'0');document.querySelector('.duelist-preview').style.setProperty('--duelist-color',d.color);}
}
const observer=new MutationObserver(preview);observer.observe(character,{childList:true});observer.observe(skin,{childList:true});character.addEventListener('change',preview);skin.addEventListener('change',preview);preview();
$('select').addEventListener('click',()=>{document.querySelector('.duelist-preview').classList.add('identity-confirmed');});for(const select of [character,skin,$('deck')])select.addEventListener('change',()=>document.querySelector('.duelist-preview').classList.remove('identity-confirmed'));

const signatures={yugi:{name:'Mago Oscuro',file:'yugi/035_yugi_dark_magician.ogg'},kaiba:{name:'Dragón Blanco de Ojos Azules',file:'kaiba/001_kaiba_blue_eyes_white_dragon.ogg'},jonouchi:{name:'Dragón Negro de Ojos Rojos',file:'jonouchi/082_jonouchi_red_eyes_black_dragon_1.ogg'}};
const summonVoice=new Audio();summonVoice.preload='none';summonVoice.volume=.75;
function announce(){const entry=signatures[character.value];if(!entry)return;summonVoice.pause();summonVoice.src='/mod-files/anime-duel-cutins/audio/jp_voices/'+entry.file;summonVoice.currentTime=0;void summonVoice.play().catch(()=>{});const caption=document.querySelector('.hero-caption p');caption.textContent='Carta estrella · '+entry.name;}
character.addEventListener('change',announce);
// A deliberate click on the selected character can replay the introduction.
$('character-cards').addEventListener('click',e=>{if(e.target.closest('button[aria-pressed="true"]'))announce();});
function moveRoster(direction){const rail=$('character-cards');rail.scrollBy({left:direction*rail.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
$('roster-prev').onclick=()=>moveRoster(-1);$('roster-next').onclick=()=>moveRoster(1);
$('character-cards').addEventListener('focusin',e=>e.target.closest('button')?.scrollIntoView({block:'nearest',inline:'nearest'}));
const stopVoice=()=>{if($('online-lobby').hidden){summonVoice.pause();summonVoice.currentTime=0;}};
new MutationObserver(stopVoice).observe($('online-lobby'),{attributes:true,attributeFilter:['hidden']});

// Menu-only music. Never overlaps loading/gameplay, hidden tabs or private runtime audio.
const menuMusic=new Audio('menu-assets/deck-building-lohweo.mp3');menuMusic.loop=true;menuMusic.preload='none';menuMusic.volume=.22;
let musicUnlocked=false,musicEnabled=true;
const musicButton=document.createElement('button');musicButton.id='menu-music-toggle';musicButton.type='button';musicButton.textContent='♫ Música del menú';musicButton.setAttribute('aria-pressed','true');musicButton.title='Pausar o activar la música del menú';document.querySelector('.player-heading').append(musicButton);
function updateMenuMusic(){const active=musicEnabled&&musicUnlocked&&!document.hidden&&!$('online-lobby').hidden;if(active)void menuMusic.play().catch(()=>{musicUnlocked=false;musicButton.textContent='♫ Activar música';});else menuMusic.pause();}
function unlockMusic(){if(musicUnlocked)return;musicUnlocked=true;updateMenuMusic();}
addEventListener('pointerdown',unlockMusic,{capture:true});addEventListener('keydown',unlockMusic,{capture:true});
musicButton.addEventListener('click',()=>{musicEnabled=!musicEnabled;musicButton.setAttribute('aria-pressed',String(musicEnabled));musicButton.textContent=musicEnabled?'♫ Música del menú':'♫ Música pausada';updateMenuMusic();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)summonVoice.pause();updateMenuMusic();});
new MutationObserver(()=>{if($('online-lobby').hidden){menuMusic.pause();menuMusic.currentTime=0;}else updateMenuMusic();}).observe($('online-lobby'),{attributes:true,attributeFilter:['hidden']});
addEventListener('pagehide',()=>{menuMusic.pause();summonVoice.pause();});
summonVoice.addEventListener('play',()=>{menuMusic.volume=.08;});for(const event of ['ended','pause','error'])summonVoice.addEventListener(event,()=>{menuMusic.volume=.22;});


// Captured from the original disc through SD_SEPlayFull and the engine SPU.
const originalMenuEffects={move:new Audio('menu-assets/fm-menu-move.wav'),confirm:new Audio('menu-assets/fm-menu-confirm.wav')};
for(const effect of Object.values(originalMenuEffects)){effect.preload='auto';effect.volume=.6;}
let lastOriginalMove=0;
function originalMenuFx(confirm=false){if(document.hidden||$('online-lobby').hidden)return;const now=performance.now();if(!confirm&&now-lastOriginalMove<90)return;if(!confirm)lastOriginalMove=now;const effect=originalMenuEffects[confirm?'confirm':'move'];effect.pause();effect.currentTime=0;void effect.play().catch(()=>{});}
// Pointer hover/focus is silent. Confirmation runs before actions can disable controls.
$('online-lobby').addEventListener('click',e=>{const button=e.target.closest('button');if(button&&!button.disabled)originalMenuFx(true);},true);
function menuFocusables(){return [...(document.querySelector('.match-found:not([hidden])')||$('online-lobby')).querySelectorAll('button,input,select')].filter(el=>!el.disabled&&!el.readOnly&&el.getClientRects().length&&!el.closest('.native-selectors'));}
function moveMenuFocus(direction){const items=menuFocusables();if(!items.length)return;let index=items.indexOf(document.activeElement);index=index<0?0:(index+direction+items.length)%items.length;items[index].focus({preventScroll:true});items[index].scrollIntoView({block:'nearest',inline:'nearest'});originalMenuFx();}
addEventListener('keydown',e=>{if($('online-lobby').hidden||e.altKey||e.ctrlKey||e.metaKey)return;if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;const direction={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[e.code];if(direction){e.preventDefault();e.stopImmediatePropagation();moveMenuFocus(direction);}else if(e.code==='KeyX'){const active=document.activeElement;if(active?.tagName==='BUTTON'&&!active.disabled){e.preventDefault();e.stopImmediatePropagation();active.click();}}},true);
let previousMenuPad=new Set(),lastMenuPadPoll=0;
function menuPadFrame(now){if(now-lastMenuPadPoll>=90){lastMenuPadPoll=now;const down=new Set();if(!document.hidden&&!$('online-lobby').hidden){const pad=[...(navigator.getGamepads?.()||[])].find(Boolean);if(pad){if(pad.buttons[12]?.pressed||pad.buttons[14]?.pressed||pad.axes[0]<-.6||pad.axes[1]<-.6)down.add('back');if(pad.buttons[13]?.pressed||pad.buttons[15]?.pressed||pad.axes[0]>.6||pad.axes[1]>.6)down.add('next');if(pad.buttons[0]?.pressed)down.add('confirm');for(const action of down)if(!previousMenuPad.has(action)){if(action==='confirm'){const focused=document.activeElement;if(focused?.tagName==='BUTTON'&&!focused.disabled)focused.click();}else moveMenuFocus(action==='back'?-1:1);}}}previousMenuPad=down;}requestAnimationFrame(menuPadFrame);}requestAnimationFrame(menuPadFrame);
function stopMenuEffects(){if(document.hidden||$('online-lobby').hidden)for(const effect of Object.values(originalMenuEffects)){effect.pause();effect.currentTime=0;}}
document.addEventListener('visibilitychange',stopMenuEffects);new MutationObserver(stopMenuEffects).observe($('online-lobby'),{attributes:true,attributeFilter:['hidden']});
