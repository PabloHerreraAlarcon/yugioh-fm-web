import { createSessionMetrics } from './session-metrics.js?v=2';
const sessionMetrics = createSessionMetrics();
import { createPerformanceDiagnostics } from './performance-diagnostics.js?v=5';
const performanceDiagnostics = createPerformanceDiagnostics(() => window.Module);
import { touchStartupMode } from './touch-options.js?v=1';
import { getRememberedDisc, rememberDisc, shouldRememberDisc, setupBrowserLibrary } from './browser-library.js?v=1';
import { setupEngineControls, engineStartupOptions } from './engine-controls.js?v=mobile-scale-01';
import { observeGameLayout } from './game-layout.js?v=2';
import { createSaveStore } from './native-saves.js?v=3';
const nativeSaves = createSaveStore(localStorage, () => window.Module?.FS, () => {
    const status = document.getElementById('save-storage-status');
    if (status) status.textContent = 'Cambios guardados en este navegador.';
});
import { prepareNativeMods, setupNativeModsUI } from './native-mods.js?v=mobile-arena-13';
/**
 * Yu-Gi-Oh! Forbidden Memories Web Online — Client Controller
 * Handles WebSocket matchmaking, room state, gamepad/keyboard polling, Nostalgist WebAssembly runtime, and UI.
 */

// =========================================================================
// 1. Audio Synthesis (Subtle Egyptian Chimes for UI feedback)
// =========================================================================
class SoundFX {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
    }

    playChime(type = 'click') {
        try {
            this.init();
            if (!this.ctx || this.ctx.state === 'suspended') {
                this.ctx?.resume();
            }
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            const now = this.ctx.currentTime;

            if (type === 'click') {
                osc.frequency.setValueAtTime(660, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'match_found') {
                // Dual Golden Chime
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
                osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
                osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.6);
            }
        } catch {
            // Audio policy fallback
        }
    }
}

const sfx = new SoundFX();

// =========================================================================
// 2. State & DOM Cache
// =========================================================================
const state = {
    ws: null,
    connected: false,
    currentRoom: null,
    playerIndex: -1, // 0 = P1 (Host), 1 = P2 (Guest)
    role: null,
    userName: localStorage.getItem('yfm_duel_name') || 'Yugi',
    gamepadConnected: false,
    inDuel: false,
    frameNumber: 0,
    emulator: null,
    romSource: '/rom/yfm.bin',
    cachedRomFile: null,
    importedSram: null
};

// DOM Elements
const el = {
    netStatus: document.getElementById('net-status'),
    gamepadStatus: document.getElementById('gamepad-status'),
    canvas: document.getElementById('canvas'),
    startScreen: document.getElementById('start-screen'),
    syncModal: document.getElementById('sync-modal'),
    resultModal: document.getElementById('result-modal'),
    
    // Inputs & Buttons
    inputNick: document.getElementById('input-nickname'),
    btnSaveName: document.getElementById('btn-save-name'),
    btnPlaySolo: document.getElementById('btn-play-solo'),
    btnPlayOnline: document.getElementById('btn-play-online'),
    btnCreateRoom: document.getElementById('btn-create-room'),
    btnJoinRoom: document.getElementById('btn-join-room'),
    inputRoomCode: document.getElementById('input-room-code'),
    btnRefreshRooms: document.getElementById('btn-refresh-rooms'),
    roomsContainer: document.getElementById('rooms-container'),
    romDetectStatus: document.getElementById('rom-detect-status'),
    btnPickCustomRom: document.getElementById('btn-pick-custom-rom'),
    romFileInput: document.getElementById('rom-file-input'),

    // Active Room UI
    activeRoomBox: document.getElementById('active-room-box'),
    displayRoomCode: document.getElementById('display-room-code'),
    p1Name: document.getElementById('p1-name'),
    p2Name: document.getElementById('p2-name'),
    btnStartDuel: document.getElementById('btn-start-duel'),
    btnCopyInvite: document.getElementById('btn-copy-invite'),
    btnLeaveRoom: document.getElementById('btn-leave-room'),

    // Duel Actions
    btnQuickChat: document.getElementById('btn-quick-chat'),
    quickPhrasesPopup: document.getElementById('quick-phrases-popup'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    btnForfeit: document.getElementById('btn-forfeit'),
    
    // Chat & Tabs
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    chatLog: document.getElementById('chat-log'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Duel HUD Avatars
    duelHudAvatars: document.getElementById('duel-hud-avatars'),
    hudP1Img: document.getElementById('hud-p1-img'),
    hudP1Name: document.getElementById('hud-p1-name'),
    hudP1LpBar: document.getElementById('hud-p1-lp-bar'),
    hudP1Lp: document.getElementById('hud-p1-lp'),
    hudP2Img: document.getElementById('hud-p2-img'),
    hudP2Name: document.getElementById('hud-p2-name'),
    hudP2LpBar: document.getElementById('hud-p2-lp-bar'),
    hudP2Lp: document.getElementById('hud-p2-lp'),

    // Anime Cutin Layer
    animeCutinLayer: document.getElementById('anime-cutin-layer'),
    cutinCharacterImg: document.getElementById('cutin-character-img'),
    cutinHeaderImg: document.getElementById('cutin-header-img'),
    cutinSpeaker: document.getElementById('cutin-speaker'),
    cutinPhrase: document.getElementById('cutin-phrase'),

    // Mods & HD Tab Controls
    selectP1Char: document.getElementById('select-p1-char'),
    selectP1Skin: document.getElementById('select-p1-skin'),
    selectP2Char: document.getElementById('select-p2-char'),
    btnTestCutinAtk: document.getElementById('btn-test-cutin-atk'),
    btnTestCutinSummon: document.getElementById('btn-test-cutin-summon'),
    toggleHudAvatars: document.getElementById('toggle-hud-avatars'),
    toggleHudTriangle: document.getElementById('toggle-hud-triangle'),

    // Card HD Browser
    cardSearchInput: document.getElementById('card-search-input'),
    cardHdPreviewImg: document.getElementById('card-hd-preview-img'),
    cardHdName: document.getElementById('card-hd-name'),
    cardHdType: document.getElementById('card-hd-type'),

    // Settings & Memory Card
    volumeSlider: document.getElementById('volume-slider'),
    volumeVal: document.getElementById('volume-val'),
    widescreenToggle: document.getElementById('widescreen-toggle'),
    hdToggle: document.getElementById('hd-toggle'),
    btnExportSave: document.getElementById('btn-export-save'),
    btnImportSave: document.getElementById('btn-import-save'),
    saveFileInput: document.getElementById('save-file-input')
};

// =========================================================================
// 3. WebSocket Matchmaking Client
// =========================================================================
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
        state.connected = true;
        el.netStatus.classList.add('online');
        el.netStatus.querySelector('.status-text').textContent = 'Conectado';
        
        // Registrar nombre de jugador
        send({ type: 'SET_NAME', name: state.userName });
        send({ type: 'GET_ROOMS' });

        // Comprobar código de sala en la URL si existe
        checkUrlRoomCode();
    };

    state.ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        } catch (e) {
            console.error('Error parseando mensaje WS:', e);
        }
    };

    state.ws.onclose = () => {
        state.connected = false;
        el.netStatus.classList.remove('online');
        el.netStatus.querySelector('.status-text').textContent = 'Desconectado';
        setTimeout(connectWebSocket, 3000);
    };

    state.ws.onerror = () => {
        state.ws.close();
    };
}

function send(msgObj) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify(msgObj));
    }
}

function handleServerMessage(data) {
    switch (data.type) {
        case 'ROOMS_LIST': {
            renderRoomsList(data.rooms || []);
            break;
        }

        case 'ROOM_CREATED': {
            sfx.playChime('click');
            state.currentRoom = data.code;
            state.playerIndex = 0;
            state.role = 'host';
            showActiveRoomUI(data.code, state.userName, 'Esperando rival...');
            addChatMessage('Sistema', `Sala ${data.code} creada. Puedes compartir el código o enlace con tu rival.`);
            break;
        }

        case 'ROOM_JOINED': {
            sfx.playChime('match_found');
            state.currentRoom = data.code;
            state.playerIndex = 1;
            state.role = 'guest';
            showActiveRoomUI(data.code, data.opponentName || 'Host', state.userName);
            addChatMessage('Sistema', `Te has unido a la sala ${data.code} contra ${data.opponentName || 'Host'}. Esperando que el host inicie.`);
            break;
        }

        case 'OPPONENT_JOINED': {
            sfx.playChime('match_found');
            el.p2Name.textContent = data.opponentName || 'Rival Conectado';
            el.btnStartDuel.disabled = false;
            el.btnStartDuel.textContent = '⚔️ Comenzar Duelo Online (2P)';
            addChatMessage('Sistema', `${data.opponentName} se ha unido a la sala.`);
            break;
        }

        case 'MATCH_STARTED': {
            sfx.playChime('match_found');
            startDuelSession(data.seed, data.playerIndex);
            break;
        }

        case 'REMOTE_INPUT': {
            // Reenvío de mando del rival
            if (state.emulator) {
                // Inyección de mando remoto si es necesario
            }
            break;
        }

        case 'CHAT_MESSAGE': {
            addChatMessage(data.sender, data.text, data.senderIndex === state.playerIndex);
            break;
        }

        case 'OPPONENT_SURRENDERED': {
            showResultModal(true, 'El adversario se ha rendido.');
            break;
        }

        case 'OPPONENT_DISCONNECTED': {
            addChatMessage('Sistema', 'El rival ha abandonado la partida.');
            if (state.inDuel) {
                showResultModal(true, 'Victoria por desconexión del adversario.');
            } else {
                el.p2Name.textContent = 'Esperando rival...';
                if (state.role === 'host') {
                    el.btnStartDuel.textContent = 'Comenzar Duelo (Solo / Práctica)';
                }
            }
            break;
        }

        case 'ERROR': {
            alert(data.message || 'Error en la conexión con la sala');
            break;
        }
    }
}

// =========================================================================
// 4. UI Actions & Rooms Management
// =========================================================================
function renderRoomsList(rooms) {
    if (!el.roomsContainer) return;
    el.roomsContainer.innerHTML = '';

    if (rooms.length === 0) {
        el.roomsContainer.innerHTML = `<p class="empty-state">No hay salas disponibles en este momento. ¡Crea una y desafía a un amigo!</p>`;
        return;
    }

    rooms.forEach(r => {
        const item = document.createElement('div');
        item.className = 'room-item';
        item.innerHTML = `
            <div>
                <strong style="color: var(--gold-light); font-family: var(--font-ancient);">${r.code}</strong>
                <span style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 0.5rem;">Host: ${r.hostName}</span>
            </div>
            <button class="btn-mini btn-join-direct" data-code="${r.code}">Unirse</button>
        `;
        el.roomsContainer.appendChild(item);
    });

    el.roomsContainer.querySelectorAll('.btn-join-direct').forEach(b => {
        b.addEventListener('click', () => {
            const code = b.getAttribute('data-code');
            send({ type: 'JOIN_ROOM', code });
        });
    });
}

function showActiveRoomUI(code, p1, p2) {
    el.displayRoomCode.textContent = code;
    el.p1Name.textContent = p1;
    el.p2Name.textContent = p2;
    el.activeRoomBox.classList.remove('hidden');

    if (state.role === 'host') {
        el.btnStartDuel.style.display = 'block';
        el.btnStartDuel.disabled = false;
        if (p2 === 'Esperando rival...') {
            el.btnStartDuel.textContent = 'Comenzar Duelo (Solo / Práctica)';
        } else {
            el.btnStartDuel.textContent = '⚔️ Comenzar Duelo Online (2P)';
        }
    } else {
        el.btnStartDuel.style.display = 'none';
    }
}

// =========================================================================
// 5. Game Engine Launch & WebAssembly Execution (Nostalgist PCSX-ReARMed)
// =========================================================================
async function launchGameSession({ isOnline = false, seed = 0, playerIndex = 0 } = {}) {
    if (state.loadingGame) return;
    const measuredAttempt = sessionMetrics.begin();
    state.loadingGame = true;
    state.inDuel = true;
    el.startScreen.classList.add('hidden');
    el.activeRoomBox.classList.add('hidden');

    const syncModal = el.syncModal;
    const syncTitle = document.getElementById('sync-title');
    const syncBar = document.getElementById('sync-bar');
    const syncPercent = document.getElementById('sync-percent');

    syncModal.classList.remove('hidden');
    syncTitle.textContent = isOnline ? 'Sincronizando Duelo Online...' : 'Iniciando Forbidden Memories...';
    syncBar.style.width = '20%';
    syncPercent.textContent = '20%';

    try {
        if (state.emulator) {
            try {
                state.emulator.exit({ removeCanvas: false });
            } catch (e) {
                console.warn('Cerrando emulador previo:', e);
            }
            state.emulator = null;
        }

        // Asegurar que la ROM esté cargada como File/Blob en memoria
        let romToLaunch = state.romSource;
        if (typeof state.romSource === 'string') {
            if (!state.cachedRomFile) {
                const romUrl = window.location.origin + state.romSource;
                syncTitle.textContent = 'Descargando Forbidden Memories a memoria (518 MB)...';
                const res = await fetch(romUrl);
                if (!res.ok) throw new Error(`El servidor devolvió HTTP ${res.status} al solicitar la ROM del juego.`);

                const contentLength = +res.headers.get('Content-Length') || 517872768;
                let receivedLength = 0;
                const reader = res.body.getReader();
                const chunks = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    receivedLength += value.length;

                    const pct = Math.min(85, Math.round(20 + (receivedLength / contentLength) * 65));
                    const mbReceived = (receivedLength / (1024 * 1024)).toFixed(0);
                    const mbTotal = (contentLength / (1024 * 1024)).toFixed(0);
                    syncBar.style.width = `${pct}%`;
                    syncPercent.textContent = `${pct}%`;
                    syncTitle.textContent = `Cargando disco en memoria (${mbReceived} MB / ${mbTotal} MB)...`;
                }

                const blob = new Blob(chunks, { type: 'application/octet-stream' });
                state.cachedRomFile = new File([blob], 'yfm.bin', { type: 'application/octet-stream' });
            }
            romToLaunch = state.cachedRomFile;
        }

        syncTitle.textContent = 'Iniciando Forbidden Memories Recompiled nativo (WebAssembly)...';
        syncBar.style.width = '0%';
        syncPercent.textContent = '';
        syncTitle.textContent = 'Leyendo disco…';

        // Obtener el buffer del disco de juego
        let romBuffer;
        if (romToLaunch instanceof Blob || romToLaunch instanceof File) {
            romBuffer = await romToLaunch.arrayBuffer();
        } else {
            const res = await fetch(romToLaunch);
            romBuffer = await res.arrayBuffer();
        }
        let romBytes = new Uint8Array(romBuffer);
        romBuffer = null; // MEMFS takes this external buffer without another full-disc copy.
        const nativeMods = await prepareNativeMods((loaded, total) => {
            syncTitle.textContent = `Preparando mods (${Math.round(loaded / 1048576)} / ${Math.round(total / 1048576)} MB)...`;
            const percent = total ? Math.min(100, Math.round(100 * loaded / total)) : 100;
            syncBar.style.width = percent + '%';
            syncPercent.textContent = percent + '%';
        });
        syncTitle.textContent = 'Mods listos. Iniciando el juego…';
        syncPercent.textContent = '';
        state.nativeAnime = nativeMods.nativeAnime;
        const fontResponse = await fetch('/assets/ui/Montserrat.ttf');
        if (!fontResponse.ok) throw new Error('No se pudo cargar la tipografía del juego.');
        const uiFontBytes = new Uint8Array(await fontResponse.arrayBuffer());
        const serifResponse = await fetch('/assets/ui/Tinos-Regular.ttf');
        if (!serifResponse.ok) throw new Error('No se pudo cargar la fuente de las cartas.');
        const serifFontBytes = new Uint8Array(await serifResponse.arrayBuffer());


        // Preparamos Module para Emscripten y esperamos onRuntimeInitialized
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Tiempo de espera agotado al inicializar WebAssembly (30s)'));
            }, 30000);

            window.Module = {
                canvas: el.canvas,
                yfmExperimentalYield: new URLSearchParams(location.search).get('presentation') !== 'standard',
                yfmWaitSample: performanceDiagnostics.enabled ? performanceDiagnostics.recordWait : undefined,
                arguments: [],
                preRun: [function(module) {
                    Object.assign(module.ENV, nativeMods.env, {
                        MEMORIES_DISC: '/game/yfm.bin',
                        MEMORIES_USER_DIR: '/game/user',
                        MEMORIES_PANELS: 'overlay',
                        MEMORIES_MEMCARD1: '/game/memcard1.mcd',
                        MEMORIES_MEMCARD2: '/game/memcard2.mcd',
                        MEMORIES_GLES: '1', MEMORIES_MENU_BAR: new URLSearchParams(location.search).get('bar') === '1' ? '1' : '0'
                    });
                    const hud = new URLSearchParams(location.search).get('hud');
                    if (hud) module.ENV.MEMORIES_SHOW_HUD = hud;
                    /* ?hd=1: texto HD del motor. ?scale=N: resolucion interna
                     * (1 es la de consola; cada paso multiplica el trabajo de CPU). */
                    const query = new URLSearchParams(location.search);
                    if (query.get('hd') === '1') module.ENV.MEMORIES_HD_TEXT = '1';
                    for (const [key,value] of Object.entries(engineStartupOptions())) module.ENV['MEMORIES_'+key.toUpperCase()] = String(value);
                    const internalScale = String(engineStartupOptions().internal_scale ?? 4);
                    module.ENV.MEMORIES_INTERNAL_SCALE = internalScale;
                    module.ENV.MEMORIES_SCALING = '1';
                    module.ENV.MEMORIES_ASPECT = localStorage.getItem('yfm_widescreen') === '0' ? '0' : '2';
                    if (performanceDiagnostics.enabled) module.ENV.MEMORIES_TRACE = 'frames';
                    performanceDiagnostics.configure(nativeMods.env,nativeMods.activeMods);
                    nativeMods.mount(module);
                    module.FS.mkdirTree('/game/fonts');
                    module.FS.writeFile('/game/fonts/interface.ttf', uiFontBytes);
                    module.ENV.MEMORIES_UI_FONT = '/game/fonts/interface.ttf';
                    module.FS.writeFile('/game/fonts/serif.ttf', serifFontBytes);
                    module.ENV.MEMORIES_SERIF_FONT = '/game/fonts/serif.ttf';
                    module.ENV.MEMORIES_HD_TEXT = '1';
                }],
                locateFile: (path) => '/mods-preview-engine/' + path + '?v=cutin-3c471122c0b9',
                print: (text) => { performanceDiagnostics.record(text); console.log('[Memories Recompiled]:', text); },
                printErr: (text) => { performanceDiagnostics.record(text); console.warn('[Memories Recompiled]:', text); },
                onRuntimeInitialized: function() {
                    clearTimeout(timeout);
                    console.log('[Memories Recompiled] Runtime WebAssembly listo. Montando disco virtual...');
                    try {
                        if (window.Module.FS) {
                            try { window.Module.FS.mkdir('/game'); } catch (e) {}
                            console.log('[Memories Recompiled] Escribiendo ROM en /game/yfm.bin (' + (romBytes.length / (1024*1024)).toFixed(1) + ' MB)...');
                            window.Module.FS.writeFile('/game/yfm.bin', romBytes, {canOwn:true});
                            romBytes = null;
                            console.log('[Memories Recompiled] Disco montado con éxito.');

                            nativeSaves.restore(window.Module.FS);
                            navigator.storage?.persist?.().catch(error => console.warn('Almacenamiento persistente no disponible:', error));
                        }
                        if (window.Module.ENV) {
                            window.Module.ENV['MEMORIES_DISC'] = '/game/yfm.bin';
                            window.Module.ENV['MEMORIES_MEMCARD1'] = '/game/memcard1.mcd';
                            window.Module.ENV['MEMORIES_MEMCARD2'] = '/game/memcard2.mcd';
                            window.Module.ENV['MEMORIES_GLES'] = '1';
                            window.Module.ENV['MEMORIES_TOUCH_CONTROLS'] = touchStartupMode();
                            /* ?hud=1 (solo fps) o ?hud=2 (panel completo: game/present
                             * en us, VBlanks perdidos, audio, disco). Lo dibuja el
                             * motor, no la página. */
                            const hud = new URLSearchParams(window.location.search).get('hud');
                            if (hud) window.Module.ENV['MEMORIES_SHOW_HUD'] = hud;
                            /* La barra File/Video/... del motor ocupa alto sobre
                             * la imagen: ?bar=1 la devuelve si hace falta. */
                            if (new URLSearchParams(window.location.search).get('bar') !== '1') {
                                window.Module.ENV['MEMORIES_MENU_BAR'] = '0';
                            }
                        }

                        // Auto-guardado persistente de Memory Card en el almacenamiento local del navegador
                        if (window._memcardSyncInterval) clearInterval(window._memcardSyncInterval);
                        window._memcardSyncInterval = setInterval(() => nativeSaves.sync(), 2000);
                        window.addEventListener('pagehide', () => nativeSaves.sync());
                        document.addEventListener('visibilitychange', () => { if (document.hidden) nativeSaves.sync(); });
                        if (typeof window.Module.callMain === 'function') {
                            window.Module.ENV.MEMORIES_INTERNAL_SCALE = String(engineStartupOptions().internal_scale ?? 4);
                            window.Module.ENV.MEMORIES_SCALING = '1';
                            console.log('[Memories Recompiled] Resolución interna inicial:', window.Module.ENV.MEMORIES_INTERNAL_SCALE);
                            console.log('[Memories Recompiled] Iniciando Forbidden Memories a 60 FPS nativo...');
                            performanceDiagnostics.configure(window.Module.ENV);
                            window.Module.callMain([]);
                            measuredAttempt.started();
                            window.dispatchEvent(new Event('yfm-engine-ready'));
                            window._stopGameLayout?.();
                            window._stopGameLayout = observeGameLayout(el.canvas, window, () => window.Module);
                        }
                        resolve();
                    } catch (err) {
                        console.error('[Memories Recompiled] Error al inicializar disco y main:', err);
                        reject(err);
                    }
                },
                onAbort: function(what) {
                    clearTimeout(timeout);
                    reject(new Error('El motor WebAssembly abortó: ' + what));
                }
            };

            const existingScript = document.getElementById('memories-pc-script');
            if (existingScript) existingScript.remove();

            const abBuild = new URLSearchParams(window.location.search).get('build');
            const abDir = '/mods-preview-engine/';
            /* Emscripten resuelve memories-pc.wasm contra la página, no contra
             * el script: sin esto el glue de ab-opt pide /memories-pc.wasm y
             * falla con "env invoke_i: function import requires a callable". */
            window.Module = window.Module || {};
            const mdecTrial = new URLSearchParams(location.search).get('engine') === 'mdec17';
            window.Module.locateFile = (file) => mdecTrial && file.endsWith('.wasm')
                ? '/memories-pc-mdec17.wasm?v=c67c5a79ca07'
                : abDir + file + '?v=cutin-3c471122c0b9';

            const script = document.createElement('script');
            script.id = 'memories-pc-script';
            script.src = mdecTrial ? '/memories-pc-mdec17.js?v=mdec-mobile18' : abDir + (new URLSearchParams(location.search).get('presentation') === 'reuse' ? 'memories-pc-reuse.js' : window.Module.yfmExperimentalYield ? 'memories-pc-message.js' : 'memories-pc.js') + '?v=' + Date.now();
            script.onerror = (e) => {
                clearTimeout(timeout);
                reject(new Error('No se pudo cargar memories-pc.js'));
            };
            document.body.appendChild(script);
        });

        // Asegurar que el canvas mantenga el 100% del contenedor
        if (el.canvas) {
            el.canvas.style.width = '100%';
            el.canvas.style.height = '100%';
            el.canvas.style.objectFit = 'contain';
        }

        syncBar.style.width = '100%';
        syncPercent.textContent = '100%';

        // Activar Avatares HUD si está habilitado
        if (!state.nativeAnime && el.duelHudAvatars && el.toggleHudAvatars?.checked) {
            updateDuelAvatars();
            el.duelHudAvatars.classList.remove('hidden');
            triangleHudHidden = false;
        }

        setTimeout(() => {
            syncModal.classList.add('hidden');
            el.canvas.focus();
        }, 300);

        sfx.playChime('match_found');
        addChatMessage('Sistema', isOnline ? `Duelo iniciado como Jugador ${playerIndex + 1}` : 'Duelo Solo iniciado.');
        state.loadingGame = false;

    } catch (err) {
        measuredAttempt.failed();
        console.error('Error al iniciar el juego:', err);
        state.loadingGame = false;
        state.inDuel = false;
        syncModal.classList.add('hidden');
        el.startScreen.classList.remove('hidden');
        alert('No se pudo iniciar el juego en el navegador:\n' + (err.message || err));
    }
}

function startDuelSession(seed, playerIndex) {
    launchGameSession({ isOnline: true, seed, playerIndex });
}

function showResultModal(isWin, cause) {
    state.inDuel = false;
    const title = document.getElementById('result-title');
    title.textContent = isWin ? '¡Ganaste!' : 'Perdiste';
    title.className = `result-title ${isWin ? '' : 'lose'}`;
    document.getElementById('result-cause').textContent = cause || 'Puntos de Vida a 0';
    el.resultModal.classList.remove('hidden');

    if (el.duelHudAvatars) {
        el.duelHudAvatars.classList.add('hidden');
    }
}

function addChatMessage(sender, text, isMe = false) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<strong style="${isMe ? 'color: var(--text-primary);' : ''}">${sender}:</strong> <span>${escapeHtml(text)}</span>`;
    el.chatLog.appendChild(div);
    el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// =========================================================================
// 5.1 Anime Duel Cut-In System & Voice Manager
// =========================================================================
let currentVoiceAudio = null;
let cutinTimer = null;
let lastTrianglePressed = false;
let triangleHudHidden = false;

function playAnimeVoice(url) {
    try {
        if (currentVoiceAudio) {
            currentVoiceAudio.pause();
            currentVoiceAudio.currentTime = 0;
        }
        const volume = (parseInt(el.volumeSlider?.value || '80', 10) / 100);
        currentVoiceAudio = new Audio(url);
        currentVoiceAudio.volume = Math.max(0, Math.min(1, volume));
        currentVoiceAudio.play().catch(() => {});
    } catch (e) {
        console.warn('No se pudo reproducir audio anime:', e);
    }
}

const CUTIN_DATABASE = {
    yugi: {
        name: 'Yugi Muto',
        avatar: '/assets/avatars/avatar_03.png',
        cutin: {
            skin1: '/assets/cutins/yugi_cutin_1080x1080.png',
            skin2: '/assets/cutins/yugi_skin2_cutin_1080x1080.png',
            skin3: '/assets/cutins/yugi_skin3_cutin_1080x1080.png'
        },
        attack: {
            header: '/assets/cutins/hd_attack_header_640x110.png',
            voice: '/assets/audio/jp_voices/yugi/035_yugi_dark_magician_attack_1.ogg',
            speaker: 'Yugi:',
            phrase: '¡Prepárate! ¡Mago Oscuro declara ataque directo! (BURAKKU MAJIKKU!)'
        },
        summon: {
            header: '/assets/cutins/hd_summon_header_640x110.png',
            voice: '/assets/audio/jp_voices/yugi/000_yugi_normal_summon.ogg',
            speaker: 'Yugi:',
            phrase: '¡Aparece ante mí! ¡Confío en el corazón de las cartas!'
        }
    },
    kaiba: {
        name: 'Seto Kaiba',
        avatar: '/assets/avatars/avatar_19_skin1.png',
        cutin: {
            skin1: '/assets/cutins/kaiba_cutin_1080x1080.png',
            skin2: '/assets/cutins/kaiba_skin2_cutin_1080x1080.png',
            skin3: '/assets/cutins/kaiba_cutin_1080x1080.png'
        },
        attack: {
            header: '/assets/cutins/kaiba_hd_attack_header_640x110.png',
            voice: '/assets/audio/jp_voices/kaiba/001_kaiba_blue_eyes_attack_1.ogg',
            speaker: 'Kaiba:',
            phrase: '¡Desaparece ante mi mayor creación! (HOROBI NO BĀSUTO SUTORĪMU!)'
        },
        summon: {
            header: '/assets/cutins/kaiba_hd_summon_header_640x110.png',
            voice: '/assets/audio/jp_voices/kaiba/000_kaiba_normal_summon.ogg',
            speaker: 'Kaiba:',
            phrase: '¡Ríndete! ¡Invoco a mi monstruo más poderoso e invencible!'
        }
    },
    jonouchi: {
        name: 'Katsuya Jonouchi',
        avatar: '/assets/avatars/avatar_03.png',
        cutin: {
            skin1: '/assets/cutins/jonouchi_cutin_1080x1080.png',
            skin2: '/assets/cutins/jonouchi_green_cutin_1080x1080.png',
            skin3: '/assets/cutins/jonouchi_skin3_cutin_1080x1080.png'
        },
        attack: {
            header: '/assets/cutins/jonouchi_hd_attack_header_640x110.png',
            voice: '/assets/audio/jp_voices/jonouchi/082_jonouchi_red_eyes_black_dragon_attack_1.ogg',
            speaker: 'Jonouchi:',
            phrase: '¡Toma esto! ¡Llamarada de Dragón Negro! (KUROKU MOERU HONŌ!)'
        },
        summon: {
            header: '/assets/cutins/jonouchi_hd_summon_header_640x110.png',
            voice: '/assets/audio/jp_voices/jonouchi/000_jonouchi_normal_summon.ogg',
            speaker: 'Jonouchi:',
            phrase: '¡Es mi turno! ¡Voy con todo lo que tengo en mi baraja!'
        }
    }
};

function triggerAnimeCutin({ character = 'yugi', skin = 'skin1', action = 'attack' } = {}) {
    if (!el.animeCutinLayer) return;

    const data = CUTIN_DATABASE[character] || CUTIN_DATABASE.yugi;
    const actData = action === 'summon' ? data.summon : data.attack;
    const cutinImg = (data.cutin && data.cutin[skin]) || data.cutin.skin1;

    // Actualizar elementos visuales
    if (el.cutinCharacterImg) el.cutinCharacterImg.src = cutinImg;
    if (el.cutinHeaderImg) el.cutinHeaderImg.src = actData.header;
    if (el.cutinSpeaker) el.cutinSpeaker.textContent = actData.speaker;
    if (el.cutinPhrase) el.cutinPhrase.textContent = actData.phrase;

    // Reproducir voz japonesa oficial
    playAnimeVoice(actData.voice);

    // Mostrar overlay cinemático con reset de animación
    el.animeCutinLayer.classList.remove('hidden');

    const charWrap = el.animeCutinLayer.querySelector('.cutin-character-wrap');
    const bannerWrap = el.animeCutinLayer.querySelector('.cutin-banner-wrap');
    if (charWrap) {
        charWrap.style.animation = 'none';
        void charWrap.offsetWidth; // Forzar reflow
        charWrap.style.animation = '';
    }
    if (bannerWrap) {
        bannerWrap.style.animation = 'none';
        void bannerWrap.offsetWidth; // Forzar reflow
        bannerWrap.style.animation = '';
    }

    if (cutinTimer) clearTimeout(cutinTimer);
    cutinTimer = setTimeout(() => {
        el.animeCutinLayer.classList.add('hidden');
    }, 2800);
}

function updateDuelAvatars() {
    const p1Char = el.selectP1Char?.value || 'yugi';
    const p2Char = el.selectP2Char?.value || 'kaiba';

    const p1Data = CUTIN_DATABASE[p1Char] || CUTIN_DATABASE.yugi;
    const p2Data = CUTIN_DATABASE[p2Char] || CUTIN_DATABASE.kaiba;

    if (el.hudP1Name) el.hudP1Name.textContent = p1Data.name;
    if (el.hudP1Img) el.hudP1Img.src = p1Data.avatar;
    if (el.hudP2Name) el.hudP2Name.textContent = p2Data.name;
    if (el.hudP2Img) el.hudP2Img.src = p2Data.avatar;
}

function toggleTriangleHud(forceState) {
    if (state.nativeAnime) return;
    if (!el.toggleHudTriangle?.checked && forceState === undefined) return;
    if (forceState !== undefined) {
        triangleHudHidden = forceState;
    } else {
        triangleHudHidden = !triangleHudHidden;
    }
    if (el.duelHudAvatars) {
        const shouldShow = el.toggleHudAvatars?.checked && !triangleHudHidden;
        el.duelHudAvatars.classList.toggle('hidden', !shouldShow);
    }
}

// =========================================================================
// 5.2 4X HD Card Browser & Showcase
// =========================================================================
const FAMOUS_CARDS = [
    { id: '001', name: 'Dragón Blanco de Ojos Azules', type: 'ATK: 3000 / DEF: 2500 · Dragón / Luz', desc: 'Este legendario dragón es una poderosa máquina destructora.' },
    { id: '004', name: 'Bebé Dragón', type: 'ATK: 1200 / DEF: 700 · Dragón / Viento', desc: 'Mucho más que un simple dragón infantil, su potencial es ilimitado.' },
    { id: '015', name: 'Espadachín de la Llama', type: 'ATK: 1800 / DEF: 1600 · Guerrero / Fuego', desc: 'Un hábil espadachín portador de una hoja envuelta en llamas ardientes.' },
    { id: '016', name: 'Mago del Tiempo', type: 'ATK: 500 / DEF: 400 · Lanzador de Conjuros / Luz', desc: 'Gira la ruleta del tiempo para acelerar el destino de los monstruos.' },
    { id: '017', name: 'Pierna Derecha del Prohibido', type: 'ATK: 200 / DEF: 300 · Lanzador de Conjuros', desc: 'Una de las cinco piezas selladas de Exodia.' },
    { id: '018', name: 'Pierna Izquierda del Prohibido', type: 'ATK: 200 / DEF: 300 · Lanzador de Conjuros', desc: 'Una de las cinco piezas selladas de Exodia.' },
    { id: '019', name: 'Brazo Derecho del Prohibido', type: 'ATK: 200 / DEF: 300 · Lanzador de Conjuros', desc: 'Una de las cinco piezas selladas de Exodia.' },
    { id: '020', name: 'Brazo Izquierdo del Prohibido', type: 'ATK: 200 / DEF: 300 · Lanzador de Conjuros', desc: 'Una de las cinco piezas selladas de Exodia.' },
    { id: '021', name: 'Exodia el Prohibido', type: 'ATK: 1000 / DEF: 1000 · Lanzador de Conjuros', desc: 'Al reunir las 5 piezas en mano, se declara la victoria automática inmediata.' },
    { id: '022', name: 'Cráneo Convocado', type: 'ATK: 2500 / DEF: 1200 · Demonio / Oscuridad', desc: 'Un demonio con poderes oscuros entre los más temidos del reino de los duelos.' },
    { id: '026', name: 'Buey de Batalla', type: 'ATK: 1700 / DEF: 1000 · Bestia Guerrera / Tierra', desc: 'Un monstruo toro que embiste a sus enemigos con un hacha pesada.' },
    { id: '035', name: 'Mago Oscuro', type: 'ATK: 2500 / DEF: 2100 · Lanzador de Conjuros / Oscuridad', desc: 'El mago definitivo en términos de ataque y defensa.' },
    { id: '038', name: 'Gaia el Caballero Feroz', type: 'ATK: 2300 / DEF: 2100 · Guerrero / Tierra', desc: 'Un caballero montado en un corcel más veloz que el viento.' },
    { id: '039', name: 'Maldición del Dragón', type: 'ATK: 2000 / DEF: 1500 · Dragón / Oscuridad', desc: 'Un dragón esquelético envuelto en una niebla sulfurosa.' },
    { id: '041', name: 'Guardián Celta', type: 'ATK: 1400 / DEF: 1200 · Guerrero / Tierra', desc: 'Un elfo espadachín que confunde a sus enemigos con veloces ataques.' },
    { id: '058', name: 'Kuriboh', type: 'ATK: 300 / DEF: 200 · Demonio / Oscuridad', desc: 'Una pequeña criatura peluda capaz de bloquear el daño de un ataque letal.' },
    { id: '062', name: 'Dama Arpía', type: 'ATK: 1300 / DEF: 1400 · Bestia Alada / Viento', desc: 'Una fiera guerrera alada con afiladas garras asesinas.' },
    { id: '068', name: 'Garoozis', type: 'ATK: 1800 / DEF: 1500 · Bestia Guerrera / Fuego', desc: 'Un guerrero bestia que lucha blandiendo una pesada espada de hierro.' },
    { id: '069', name: 'Dragón Milenario', type: 'ATK: 2400 / DEF: 2000 · Dragón / Viento', desc: 'El Bebé Dragón envejecido un millar de años por el Mago del Tiempo.' },
    { id: '078', name: 'Asaltante del Hacha', type: 'ATK: 1700 / DEF: 1150 · Guerrero / Tierra', desc: 'Un guerrero hacha de combate que no teme a ningún oponente.' },
    { id: '082', name: 'Dragón Negro de Ojos Rojos', type: 'ATK: 2400 / DEF: 2000 · Dragón / Oscuridad', desc: 'Un dragón feroz con un ataque mortal que trae la victoria a quienes creen en él.' },
    { id: '217', name: 'Dragón Calavera Negro', type: 'ATK: 3200 / DEF: 2500 · Dragón / Oscuridad', desc: 'Fusión destructiva del Cráneo Convocado y el Dragón Negro de Ojos Rojos.' },
    { id: '348', name: 'Espadas de la Luz Reveladora', type: 'Mágica · Bloqueo de 3 Turnos', desc: 'Inmoviliza a todos los monstruos del adversario durante tres turnos completos.' },
    { id: '364', name: 'Soldado del Brillo Negro', type: 'ATK: 3000 / DEF: 2500 · Guerrero / Tierra', desc: 'Invocado por ritual, posee un poder legendario comparable al Ojos Azules.' },
    { id: '371', name: 'Slifer el Dragón del Cielo', type: 'ATK: ???? / DEF: ???? · Dios Egipcio / Divino', desc: 'Dios Egipcio cuyo poder asciende en 1000 por cada carta en la mano del duelista.' },
    { id: '372', name: 'Obelisco el Atormentador', type: 'ATK: 4000 / DEF: 4000 · Dios Egipcio / Divino', desc: 'Su descenso sacude los cielos y su puño desata el Puño del Destino.' },
    { id: '373', name: 'El Dragón Alado de Ra', type: 'ATK: ???? / DEF: ???? · Dios Egipcio / Divino', desc: 'El Dios Supremo del sol dorado del Antiguo Egipto.' },
    { id: '380', name: 'Dragón Blanco de Ojos Azules Definitivo', type: 'ATK: 4500 / DEF: 3800 · Dragón / Luz', desc: 'La temible unión de los tres Dragones Blancos de Kaiba.' },
    { id: '713', name: 'Dragón Meteoro Negro', type: 'ATK: 3500 / DEF: 2000 · Dragón / Fuego', desc: 'Fusión devastadora del Dragón Negro de Ojos Rojos y el Dragón Meteoro.' },
    { id: '722', name: 'Mago del Caos Negro', type: 'ATK: 2800 / DEF: 2600 · Lanzador de Conjuros / Oscuridad', desc: 'El Mago Supremo que domina las artes arcanas del caos cósmico.' }
];

function selectCardHd(cardId) {
    const padded = String(cardId).padStart(3, '0');
    const found = FAMOUS_CARDS.find(c => c.id === padded);
    if (el.cardHdPreviewImg) {
        el.cardHdPreviewImg.src = `/assets/cards-hd/card-${padded}.png`;
    }
    if (el.cardHdName) {
        el.cardHdName.textContent = found ? `#${padded} - ${found.name}` : `#${padded} - Carta Yu-Gi-Oh!`;
    }
    if (el.cardHdType) {
        el.cardHdType.textContent = found ? `${found.type} · ${found.desc}` : 'Carta de Yu-Gi-Oh! Forbidden Memories en 4K HD';
    }
}

// =========================================================================
// 6. Gamepad API Support (Polling a 60 Hz)
// =========================================================================
function setupGamepadPolling() {
    window.addEventListener('gamepadconnected', (e) => {
        state.gamepadConnected = true;
        el.gamepadStatus.classList.add('connected');
        el.gamepadStatus.querySelector('.label').textContent = e.gamepad.id.slice(0, 10);
    });

    window.addEventListener('gamepaddisconnected', () => {
        state.gamepadConnected = false;
        el.gamepadStatus.classList.remove('connected');
        el.gamepadStatus.querySelector('.label').textContent = 'Mando';
    });

    function pollGamepad() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[0];
        if (gp && state.inDuel && state.ws && state.ws.readyState === WebSocket.OPEN) {
            let padMask = 0;
            if (gp.buttons[0]?.pressed) padMask |= (1 << 6); // Cross (X)
            if (gp.buttons[1]?.pressed) padMask |= (1 << 5); // Circle (○)
            if (gp.buttons[2]?.pressed) padMask |= (1 << 7); // Square (□)
            // Botón Triángulo (△) para inspeccionar cartas e alternar el HUD de avatares
            const trianglePressed = !!gp.buttons[3]?.pressed;
            if (trianglePressed && !lastTrianglePressed) {
                toggleTriangleHud();
            }
            lastTrianglePressed = trianglePressed;
            if (trianglePressed) padMask |= (1 << 4); // Triangle (△)

            if (gp.buttons[9]?.pressed) padMask |= (1 << 11); // Start
            if (gp.buttons[8]?.pressed) padMask |= (1 << 0); // Select
            
            // D-Pad
            if (gp.axes[1] < -0.4 || gp.buttons[12]?.pressed) padMask |= (1 << 12); // Up
            if (gp.axes[1] > 0.4 || gp.buttons[13]?.pressed) padMask |= (1 << 14);  // Down
            if (gp.axes[0] < -0.4 || gp.buttons[14]?.pressed) padMask |= (1 << 15); // Left
            if (gp.axes[0] > 0.4 || gp.buttons[15]?.pressed) padMask |= (1 << 13);  // Right

            if (padMask !== 0) {
                state.frameNumber++;
                send({
                    type: 'INPUT',
                    pad: padMask,
                    frame: state.frameNumber
                });
            }
        }
        requestAnimationFrame(pollGamepad);
    }
    requestAnimationFrame(pollGamepad);
}

// =========================================================================
// 7. Event Listeners Setup
// =========================================================================
function setupEventListeners() {
    // ⚔️ Duelo Solo
    el.btnPlaySolo?.addEventListener('click', () => {
        sfx.playChime('click');
        launchGameSession({ isOnline: false });
    });

    // ⚡ Jugar Online (2P)
    el.btnPlayOnline?.addEventListener('click', () => {
        sfx.playChime('click');
        // Activar pestaña Salas
        el.tabButtons.forEach(b => b.classList.remove('active'));
        el.tabContents.forEach(c => c.classList.remove('active'));
        const roomsTabBtn = document.querySelector('.tab-btn[data-tab="online"]');
        roomsTabBtn?.classList.add('active');
        document.getElementById('tab-online')?.classList.add('active');
        
        // Enfocar acciones de sala
        el.btnCreateRoom?.scrollIntoView({ behavior: 'smooth' });
    });

    // Selector de ROM personalizada
    el.btnPickCustomRom?.addEventListener('click', () => {
        el.romFileInput?.click();
    });

    el.romFileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            state.romSource = file;
            window.yfmRememberedDisc = true;
            const discStatus=document.getElementById('disc-storage-status');
            if(discStatus&&shouldRememberDisc())discStatus.textContent='Guardando copia local del disco… Puedes iniciar el juego.';
            rememberDisc(file).then(()=>{if(discStatus&&shouldRememberDisc()&&state.romSource===file)discStatus.textContent='Disco guardado para la próxima visita.';}).catch(() => {
                if(discStatus&&state.romSource===file)discStatus.textContent='No se pudo guardar la copia local. Puedes jugar igualmente.';
                if(el.romDetectStatus) el.romDetectStatus.textContent = 'Disco listo para esta sesión. No se pudo guardar una copia local.';
            });
            if (el.romDetectStatus) {
                el.romDetectStatus.textContent = `✦ Disco cargado: ${file.name} (${(file.size / (1024*1024)).toFixed(1)} MB) · Listo`;
                el.romDetectStatus.style.color = '#38bdf8';
                el.romDetectStatus.style.borderColor = 'rgba(56, 189, 248, 0.3)';
            }
            sfx.playChime('click');
        }
    });

    // Tabs Navigation
    el.tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            sfx.playChime('click');
            const target = btn.getAttribute('data-tab');
            el.tabButtons.forEach(b => b.classList.remove('active'));
            el.tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${target}`)?.classList.add('active');
        });
    });

    // Guardar nombre
    el.btnSaveName?.addEventListener('click', () => {
        const val = el.inputNick.value.trim();
        if (val) {
            state.userName = val;
            localStorage.setItem('yfm_duel_name', val);
            send({ type: 'SET_NAME', name: val });
            sfx.playChime('click');
            alert(`Nombre guardado: ${val}`);
        }
    });



    // Crear sala
    el.btnCreateRoom?.addEventListener('click', () => {
        sfx.playChime('click');
        send({ type: 'CREATE_ROOM' });
    });

    // Unirse a sala por código
    el.btnJoinRoom?.addEventListener('click', () => {
        sfx.playChime('click');
        const code = el.inputRoomCode.value.trim().toUpperCase();
        if (code.length === 4) {
            send({ type: 'JOIN_ROOM', code });
        } else {
            alert('El código de sala debe ser de 4 letras (ej: ABCD).');
        }
    });

    // Iniciar Duelo
    el.btnStartDuel?.addEventListener('click', () => {
        sfx.playChime('click');
        if (state.role === 'host') {
            const isWaiting = el.p2Name && el.p2Name.textContent && el.p2Name.textContent.includes('Esperando');
            if (isWaiting) {
                // Iniciar partida Solo / Práctica de inmediato
                addChatMessage('Sistema', 'Iniciando partida en modo Solo / Práctica...');
                launchGameSession({ isOnline: false });
            } else {
                send({ type: 'START_MATCH' });
            }
        } else {
            alert('Solo el host de la sala puede iniciar el duelo.');
        }
    });

    // Copiar enlace de invitación
    el.btnCopyInvite?.addEventListener('click', () => {
        if (!state.currentRoom) return;
        const url = `${window.location.origin}/?room=${state.currentRoom}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                sfx.playChime('click');
                addChatMessage('Sistema', `Enlace copiado: ${url}. Compártelo con tu rival.`);
                alert(`¡Enlace copiado al portapapeles!\n${url}\nCompártelo con tu rival para que entre directo.`);
            }).catch(() => {
                prompt('Copia este enlace de invitación:', url);
            });
        } else {
            prompt('Copia este enlace de invitación:', url);
        }
    });

    // Salir de sala
    el.btnLeaveRoom?.addEventListener('click', () => {
        el.activeRoomBox.classList.add('hidden');
        state.currentRoom = null;
        send({ type: 'GET_ROOMS' });
    });

    // Refrescar salas
    el.btnRefreshRooms?.addEventListener('click', () => {
        send({ type: 'GET_ROOMS' });
    });

    // Chat
    el.chatForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = el.chatInput.value.trim();
        if (text) {
            send({ type: 'CHAT', text });
            el.chatInput.value = '';
        }
    });

    // Quick Chat Phrases
    el.btnQuickChat?.addEventListener('click', () => {
        el.quickPhrasesPopup.classList.toggle('hidden');
    });

    document.querySelectorAll('.phrase-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const phrase = chip.getAttribute('data-phrase');
            send({ type: 'CHAT', text: phrase });
            el.quickPhrasesPopup.classList.add('hidden');
        });
    });

    // Keep a browser-owned exit action available even when SDL captures Escape.
    const fullscreenExit = document.createElement('button');
    fullscreenExit.textContent = '×';
    fullscreenExit.setAttribute('aria-label', 'Salir de pantalla completa');
    fullscreenExit.title = 'Salir de pantalla completa';
    fullscreenExit.style.cssText = 'position:absolute;right:14px;top:14px;z-index:1000;width:38px;height:38px;border:1px solid #ffffff55;border-radius:50%;background:#011627bb;color:white;font-size:24px;cursor:pointer';
    fullscreenExit.hidden = true;
    document.getElementById('screen-container')?.append(fullscreenExit);
    fullscreenExit.onclick = () => document.exitFullscreen().catch(() => {});
    document.addEventListener('fullscreenchange', () => { fullscreenExit.hidden = !document.fullscreenElement; });
    // Pantalla completa
    el.btnFullscreen?.addEventListener('click', () => {
        const container = document.getElementById('screen-container');
        if (!document.fullscreenElement) {
            container?.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    });

    // Rendirse
    el.btnForfeit?.addEventListener('click', () => {
        if (state.inDuel && confirm('¿Estás seguro de que deseas rendirte en este duelo?')) {
            send({ type: 'SURRENDER' });
            showResultModal(false, 'Te has rendido.');
        }
    });

    // Resultados -> Volver a salas
    document.getElementById('btn-result-lobby')?.addEventListener('click', () => {
        el.resultModal.classList.add('hidden');
        el.startScreen.classList.remove('hidden');
        send({ type: 'GET_ROOMS' });
    });

    // =====================================================================
    // Memory Card (Exportar / Importar)
    // =====================================================================
    function downloadSave(previous = false) {
        try {
            const files = nativeSaves.exportFiles(previous);
            const selected = files.length === 1 ? files[0] : files[Number(prompt('¿Qué ranura quieres exportar?\n' + files.map((file, i) => `${i + 1}: ${file.name}`).join('\n'), '1')) - 1];
            if (!selected) return;
            const url = URL.createObjectURL(new Blob([selected.bytes], { type: 'application/octet-stream' }));
            const a = document.createElement('a');
            a.href = url; a.download = previous ? 'respaldo-anterior-' + selected.name : selected.name; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            addChatMessage('Sistema', `Partida exportada: ${selected.name}`);
        } catch (error) { alert(error.message); }
    }
    el.btnExportSave?.addEventListener('click', () => downloadSave());
    document.getElementById('btn-export-previous-save')?.addEventListener('click', () => downloadSave(true));
    el.btnImportSave?.addEventListener('click', () => el.saveFileInput?.click());
    el.saveFileInput?.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            if (file.size !== 8192 && file.size !== 131072) throw new Error('El archivo debe ser una partida .sav de 8 KB o una memory card raw de 128 KB.');
            const message = nativeSaves.importBytes(new Uint8Array(await file.arrayBuffer()));
            alert(message);
            addChatMessage('Sistema', message);
        } catch (error) { alert('No se pudo importar: ' + error.message); }
        finally { event.target.value = ''; }
    });

    // =====================================================================
    // Ajustes de Sonido y Video
    // =====================================================================
    el.volumeSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        if (el.volumeVal) el.volumeVal.textContent = `${val}%`;
        localStorage.setItem('yfm_audio_volume', val);
    });

    el.widescreenToggle?.addEventListener('change', (e) => {
        sfx.playChime('click');
        const screen = document.getElementById('screen-container');
        if (screen) {
            screen.style.aspectRatio = e.target.checked ? '16/9' : '4/3';
        }
        localStorage.setItem('yfm_widescreen', e.target.checked ? '1' : '0');
    });

    el.hdToggle?.addEventListener('change', (e) => {
        sfx.playChime('click');
        if (el.canvas) {
            el.canvas.style.imageRendering = e.target.checked ? 'auto' : 'pixelated';
        }
        localStorage.setItem('yfm_hd_textures', e.target.checked ? '1' : '0');
    });

    // Atajo de teclado para alternar HUD con Triángulo (Tecla I o Triángulo en gamepad)
    window.addEventListener('keydown', (e) => {
        if (state.inDuel && (e.code === 'KeyI' || e.key === 'i' || e.key === 'I')) {
            toggleTriangleHud();
        }
    });

    // Probar Cut-Ins de Anime con Audio y Cinemática
    el.btnTestCutinAtk?.addEventListener('click', () => {
        sfx.playChime('click');
        const character = el.selectP1Char?.value || 'yugi';
        const skin = el.selectP1Skin?.value || 'skin1';
        triggerAnimeCutin({ character, skin, action: 'attack' });
    });

    el.btnTestCutinSummon?.addEventListener('click', () => {
        sfx.playChime('click');
        const character = el.selectP1Char?.value || 'yugi';
        const skin = el.selectP1Skin?.value || 'skin1';
        triggerAnimeCutin({ character, skin, action: 'summon' });
    });

    // Cambios de selección de duelistas y skins
    el.selectP1Char?.addEventListener('change', () => {
        updateDuelAvatars();
        localStorage.setItem('yfm_p1_char', el.selectP1Char.value);
    });

    el.selectP1Skin?.addEventListener('change', () => {
        localStorage.setItem('yfm_p1_skin', el.selectP1Skin.value);
    });

    el.selectP2Char?.addEventListener('change', () => {
        updateDuelAvatars();
        localStorage.setItem('yfm_p2_char', el.selectP2Char.value);
    });

    // Toggles de HUD
    el.toggleHudAvatars?.addEventListener('change', (e) => {
        if (el.duelHudAvatars) {
            el.duelHudAvatars.classList.toggle('hidden', !e.target.checked || !state.inDuel);
        }
        localStorage.setItem('yfm_hud_avatars', e.target.checked ? '1' : '0');
    });

    el.toggleHudTriangle?.addEventListener('change', (e) => {
        localStorage.setItem('yfm_hud_triangle', e.target.checked ? '1' : '0');
    });

    // Chips de cartas HD famosas
    document.querySelectorAll('.chip-card').forEach(chip => {
        chip.addEventListener('click', () => {
            sfx.playChime('click');
            const cardId = chip.getAttribute('data-card');
            selectCardHd(cardId);
        });
    });

    // Buscador interactivo de cartas HD
    el.cardSearchInput?.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) return;

        const num = parseInt(query.replace(/\D/g, ''), 10);
        if (num >= 1 && num <= 722) {
            selectCardHd(num);
            return;
        }

        const match = FAMOUS_CARDS.find(c => c.name.toLowerCase().includes(query) || c.type.toLowerCase().includes(query));
        if (match) {
            selectCardHd(match.id);
        }
    });
}

async function checkServerRom() {
    el.btnPlaySolo.disabled = true;
    try {
        const file = await getRememberedDisc();
        if (file && !(state.romSource instanceof Blob)) {
            state.romSource = file; window.yfmRememberedDisc = true;
            if(el.btnPickCustomRom) el.btnPickCustomRom.textContent = 'Disco recordado · Cambiar disco';
            if(el.romDetectStatus) el.romDetectStatus.textContent = 'Disco recordado en este navegador. Listo para jugar.';
            return;
        }
        if (state.romSource instanceof Blob) return;
        const response = await fetch('/api/rom-status'), data = await response.json();
        if (state.romSource instanceof Blob) return;
        if(data.available) {
            state.romSource = data.path; window.yfmRememberedDisc = true;
            if(el.romDetectStatus) el.romDetectStatus.textContent = 'Disco local detectado. Listo para jugar.';
        } else if(el.romDetectStatus) el.romDetectStatus.textContent = 'Selecciona tu disco una vez para comenzar.';
    } catch { /* Manual disc selection remains available. */ }
    finally { el.btnPlaySolo.disabled = false; }
}

function checkUrlRoomCode() {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode && roomCode.length === 4) {
        if (el.inputRoomCode) el.inputRoomCode.value = roomCode.toUpperCase();
        el.tabButtons.forEach(b => b.classList.remove('active'));
        el.tabContents.forEach(c => c.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="online"]')?.classList.add('active');
        document.getElementById('tab-online')?.classList.add('active');

        if (state.connected) {
            send({ type: 'JOIN_ROOM', code: roomCode.toUpperCase() });
        }
    }
}

// =========================================================================
// 8. Memory Card Persistence Helpers
// =========================================================================
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToUint8Array(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function getStoredSramFile() {
    const b64 = localStorage.getItem('yfm_memory_card');
    if (b64) {
        try {
            const bytes = base64ToUint8Array(b64);
            return new File([bytes], 'yfm.srm', { type: 'application/octet-stream' });
        } catch (e) {
            console.error('Error leyendo save guardado:', e);
        }
    }
    return null;
}

async function persistCurrentSram() {
    if (state.emulator) {
        try {
            const blob = await state.emulator.saveSRAM();
            if (blob && blob.size > 0) {
                const buf = await blob.arrayBuffer();
                const b64 = arrayBufferToBase64(buf);
                localStorage.setItem('yfm_memory_card', b64);
                return blob;
            }
        } catch (e) {
            // saveSRAM puede no estar listo si aún no se ha guardado en el juego
        }
    }
    return null;
}

// Auto-guardado periódico de cartas cada 12s durante un duelo
setInterval(() => {
    if (state.inDuel && state.emulator) {
        persistCurrentSram();
    }
}, 12000);

window.addEventListener('beforeunload', () => {
    if (state.inDuel && state.emulator) {
        persistCurrentSram();
    }
});

function restoreUserSettings() {
    // Restaurar Widescreen
    const savedWide = localStorage.getItem('yfm_widescreen') ?? '1';
    if (savedWide !== null && el.widescreenToggle) {
        el.widescreenToggle.checked = savedWide === '1';
        const screen = document.getElementById('screen-container');
        if (screen) screen.style.aspectRatio = savedWide === '1' ? '16/9' : '4/3';
    }

    // Restaurar Texturas HD
    const savedHD = localStorage.getItem('yfm_hd_textures');
    if (savedHD !== null && el.hdToggle) {
        el.hdToggle.checked = savedHD === '1';
        if (el.canvas) el.canvas.style.imageRendering = savedHD === '1' ? 'auto' : 'pixelated';
    }

    // Restaurar Volumen
    const savedVol = localStorage.getItem('yfm_audio_volume');
    if (savedVol !== null && el.volumeSlider) {
        el.volumeSlider.value = savedVol;
        if (el.volumeVal) el.volumeVal.textContent = `${savedVol}%`;
    }

    // Restaurar opciones de Mods Anime & HD
    const savedP1 = localStorage.getItem('yfm_p1_char');
    if (savedP1 && el.selectP1Char) el.selectP1Char.value = savedP1;

    const savedSkin = localStorage.getItem('yfm_p1_skin');
    if (savedSkin && el.selectP1Skin) el.selectP1Skin.value = savedSkin;

    const savedP2 = localStorage.getItem('yfm_p2_char');
    if (savedP2 && el.selectP2Char) el.selectP2Char.value = savedP2;

    const savedAvatars = localStorage.getItem('yfm_hud_avatars');
    if (savedAvatars !== null && el.toggleHudAvatars) el.toggleHudAvatars.checked = savedAvatars === '1';

    const savedTriangle = localStorage.getItem('yfm_hud_triangle');
    if (savedTriangle !== null && el.toggleHudTriangle) el.toggleHudTriangle.checked = savedTriangle === '1';

    updateDuelAvatars();
    selectCardHd('035');
}

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
    if (el.inputNick) el.inputNick.value = state.userName;
    setupEventListeners();
    setupGamepadPolling();
    restoreUserSettings();
    setupBrowserLibrary(() => state.romSource,()=>{
        if(!el.romFileInput?.files?.length){state.romSource='/rom/yfm.bin';window.yfmRememberedDisc=false;if(el.btnPickCustomRom)el.btnPickCustomRom.textContent='Seleccionar mi disco (.bin)';}
    });
    checkServerRom();
    connectWebSocket();
});

/* ?clean=1: la barra de vida con avatares es de la página, no del juego. Con
 * este parámetro se oculta y queda solo la imagen del juego. El juego dibuja
 * sus propios LP dentro de la pantalla, así que no se pierde información. */
if (new URLSearchParams(window.location.search).get('clean') === '1') {
    const style = document.createElement('style');
    style.textContent = '#duel-hud-avatars{display:none!important}';
    document.head.appendChild(style);
}

setupNativeModsUI();


setupEngineControls(() => window.Module);
performanceDiagnostics.setup();


sessionMetrics.setup();
