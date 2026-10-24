/** Keep SDL's window/overlay geometry in step with the displayed canvas.
 * SDL listens to window resize, but its own video settings change the canvas
 * backing size without resizing the browser. CSS also resizes the game panel
 * independently. Notify SDL after layout, never write canvas dimensions here:
 * the GPU's internal game resolution remains owned by the engine.
 */
export function observeGameLayout(canvas, target = window, getModule = () => null) {
    let pending = 0, signature = '', stopped = false;
    const flush = () => {
        pending = 0;
        if (stopped || !canvas.isConnected) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const next = [Math.round(rect.width * 100), Math.round(rect.height * 100),
            canvas.width, canvas.height, target.devicePixelRatio].join(':');
        if (next === signature) return;
        signature = next;
        const module = getModule();
        if (typeof module?._YfmWeb_Resize === 'function') {
            module._YfmWeb_Resize(Math.round(rect.width), Math.round(rect.height));
        } else target.dispatchEvent(new Event('resize'));
    };
    const schedule = () => {
        if (!pending && !stopped) pending = target.requestAnimationFrame(flush);
    };
    const ready = () => { signature = ''; schedule(); };
    const size = new ResizeObserver(schedule);
    size.observe(canvas);
    const backing = new MutationObserver(schedule);
    backing.observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
    const doc = canvas.ownerDocument || target.document;
    doc?.addEventListener('fullscreenchange', schedule);
    target.addEventListener('resize', schedule);
    target.visualViewport?.addEventListener('resize', schedule);
    target.addEventListener('yfm-engine-ready', ready);
    schedule();
    return () => {
        stopped = true;
        size.disconnect(); backing.disconnect();
        doc?.removeEventListener('fullscreenchange', schedule);
        target.removeEventListener('resize', schedule);
        target.visualViewport?.removeEventListener('resize', schedule);
        target.removeEventListener('yfm-engine-ready', ready);
        if (pending) target.cancelAnimationFrame(pending);
    };
}

