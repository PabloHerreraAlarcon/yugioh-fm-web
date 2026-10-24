/**
 * Yu-Gi-Oh! Forbidden Memories Web - Configuracion de Red (Codex Multiplayer)
 * Este archivo permite definir la URL del servidor WebSocket sin tocar el motor.
 */
window.YFM_NETWORK_CONFIG = {
    // Si Codex publica el servidor en Render, Fly.io o VPS, se coloca la URL aqui:
    // Ejemplo: 'wss://yfm-duel-server.onrender.com'
    wsServerUrl: (function() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('ws')) return urlParams.get('ws');
        const saved = localStorage.getItem('yfm_ws_server');
        if (saved) return saved;
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
        }
        return null;
    })(),
    protocolVersion: '1.0'
};
