// Optional startup-only counters. Never inspect the engine, save files or error text.
const KEY = 'yfm_session_metrics_consent_v1';
export function createSessionMetrics(platform = globalThis) {
  let consent = false;
  try {consent = platform.localStorage.getItem(KEY) === 'yes';} catch {}
  const allowed = () => consent && platform.navigator.doNotTrack !== '1' &&
    !platform.navigator.globalPrivacyControl && !platform.navigator.webdriver &&
    ['yugiohfm.online', 'yugioh-fm-web.pages.dev'].includes(platform.location.hostname) &&
    !new URLSearchParams(platform.location.search).has('performance');
  function send(event) {
    if (!allowed()) return;
    try {
      const controller = new AbortController();
      const timeout = platform.setTimeout(() => controller.abort(), 3000);
      Promise.resolve(platform.fetch('/api/session-event', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({v: 1, event}), credentials: 'omit',
        referrerPolicy: 'no-referrer', cache: 'no-store', keepalive: true,
        signal: controller.signal
      })).catch(() => {}).finally(() => platform.clearTimeout(timeout));
    } catch {} // Measurement must never prevent startup.
  }
  function begin() {
    let terminal = false;
    const eligible = allowed();
    send('launch_attempt');
    return {
      started() {if (!terminal) {terminal = true; if (eligible) send('runtime_started');}},
      failed() {if (!terminal) {terminal = true; if (eligible) send('launch_error');}}
    };
  }
  function setup() {
    const panel = platform.document.getElementById('tab-general');
    if (!panel || panel.querySelector('[data-session-metrics]')) return;
    const box = platform.document.createElement('details');
    box.className = 'session-metrics-panel'; box.dataset.sessionMetrics = '1';
    box.innerHTML = '<summary>Ayudar a mejorar el juego <span>Opcional</span></summary><div class="session-metrics-body"><label><span>Compartir estadísticas de inicio</span><input type="checkbox" role="switch"></label><p>Solo cuenta inicios y fallos de carga. Tus partidas, disco y nombres permanecen en tu navegador.</p><small>No identifica jugadores únicos. Puedes desactivarlo cuando quieras.</small></div>';
    const input = box.querySelector('input'); input.checked = consent;
    input.addEventListener('change', () => {
      consent = input.checked;
      try {platform.localStorage.setItem(KEY, consent ? 'yes' : 'no');} catch {}
    });
    panel.append(box);
  }
  return {begin, setup};
}
