// Private browser storage only. Never uploads the user's disc or touches saves.
const CACHE = 'yfm-mod-assets-v1', DIR = 'yfm-library-v1', PREF = 'yfm_remember_disc_v1';
let cachePromise, writableCache = true;
let discQueue = Promise.resolve();
function changeDisc(action) {
    const run = () => navigator.locks ? navigator.locks.request('yfm-disc-library-v1', action) : action();
    const next = discQueue.then(run, run); discQueue = next.catch(() => {}); return next;
}
export const cacheStats = { hits: 0, downloads: 0, stored: 0 };
const notify = () => window.dispatchEvent(new Event('yfm-library-change'));
const cache = () => cachePromise ||= (globalThis.caches ? caches.open(CACHE).catch(() => null) : Promise.resolve(null));
export const shouldRememberDisc = () => localStorage.getItem(PREF) !== '0';
async function directory() { return (await navigator.storage.getDirectory()).getDirectoryHandle(DIR, { create: true }); }
async function dbRequest(mode, action) {
    const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('yfm-disc-library-v1', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('disc');
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    try { return await new Promise((resolve, reject) => {
        const tx = db.transaction('disc', mode), req = action(tx.objectStore('disc'));
        let result; req.onsuccess = () => { result = req.result; };
        tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    }); } finally { db.close(); }
}
export async function getRememberedDisc() {
    if (!shouldRememberDisc()) return null;
    if (navigator.storage?.getDirectory) try {
        const dir = await directory(), meta = JSON.parse(await (await (await dir.getFileHandle('disc.json')).getFile()).text());
        if (!/^disc-[a-f0-9-]+\.bin$/.test(meta.file)) return null;
        const blob = await (await dir.getFileHandle(meta.file)).getFile();
        if (blob.size !== meta.size) return null;
        return new File([blob], meta.name, { lastModified: meta.modified });
    } catch { /* Missing/evicted files are recoverable by choosing the disc again. */ }
    try { return await dbRequest('readonly', s => s.get('current')) || null; } catch { return null; }
}
export function rememberDisc(file) { return changeDisc(() => saveDisc(file)); }
async function saveDisc(file) {
    if (!shouldRememberDisc()) return;
    if (navigator.storage?.getDirectory) {
        const dir = await directory(); let previous;
        try { previous = JSON.parse(await (await (await dir.getFileHandle('disc.json')).getFile()).text()); } catch {}
        const name = 'disc-' + crypto.randomUUID() + '.bin';
        try {
            const target = await dir.getFileHandle(name, { create: true });
            await file.stream().pipeTo(await target.createWritable());
            const metadata = await (await dir.getFileHandle('disc.json', { create: true })).createWritable();
            await metadata.write(JSON.stringify({ file: name, name: file.name, size: file.size, modified: file.lastModified }));
            await metadata.close();
        } catch (error) { await dir.removeEntry(name).catch(() => {}); throw error; }
        if (previous?.file !== name && /^disc-[a-f0-9-]+\.bin$/.test(previous?.file || '')) await dir.removeEntry(previous.file).catch(() => {});
    } else await dbRequest('readwrite', s => s.put(file, 'current'));
    await navigator.storage?.persist?.().catch(() => false); notify();
}
export function forgetDisc() { return changeDisc(removeDisc); }
async function removeDisc() {
    if (navigator.storage?.getDirectory) try {
        const dir = await directory();
        for await (const name of dir.keys()) if (name === 'disc.json' || /^disc-[a-f0-9-]+\.bin$/.test(name)) await dir.removeEntry(name);
    } catch {}
    await dbRequest('readwrite', s => s.delete('current')).catch(() => {}); notify();
}
export async function cachedModBytes(url, file, options = {}) {
    if (options.signal?.aborted) throw new DOMException('Carga cancelada', 'AbortError');
    const store = await cache();
    if (store) try {
        const hit = await store.match(url);
        if (hit && hit.headers.get('x-yfm-version') === file.version) {
            const bytes = new Uint8Array(await hit.arrayBuffer());
            if (bytes.length === file.bytes) { cacheStats.hits++; return bytes; }
        }
        if (hit) await store.delete(url);
    } catch { /* A browser cache failure must not prevent playing. */ }
    let response, bytes;
    if (file.compressed && typeof DecompressionStream === 'function') try {
        const packedUrl = '/mod-files/' + [file.folder, ...file.compressed.path.split('/')].map(encodeURIComponent).join('/') + '?v=' + file.compressed.version;
        response = await fetch(packedUrl, options);
        if (!response.ok || (response.headers.get('content-type') || '').includes('text/html')) throw Error('Compressed asset unavailable');
        const packed = await response.arrayBuffer();
        // Some hosts transparently decompress; otherwise decode the lossless file.
        if (packed.byteLength === file.bytes) bytes = new Uint8Array(packed);
        else {
            if (packed.byteLength !== file.compressed.bytes) throw Error('Incomplete compressed asset');
            bytes = new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
        }
        if (bytes.length !== file.bytes) throw Error('Invalid decompressed size');
    } catch (error) { if (options.signal?.aborted) throw error; bytes = null; }
    if (!bytes) {
        response = await fetch(url, options);
        if (!response.ok || (response.headers.get('content-type') || '').includes('text/html')) throw Error('No se pudo cargar el archivo: ' + file.path);
        bytes = new Uint8Array(await response.arrayBuffer());
    }
    if (bytes.length !== file.bytes) throw Error('Archivo incompleto: ' + file.path);
    if (crypto.subtle && /^[a-f0-9]{16,64}$/i.test(file.version)) {
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
        if (!digest.startsWith(file.version.toLowerCase())) throw Error('El archivo no coincide con su versión: ' + file.path);
    }
    cacheStats.downloads++;
    if (store && writableCache) try {
        await store.put(url, new Response(bytes, { headers: { 'content-type': response.headers.get('content-type') || 'application/octet-stream', 'x-yfm-version': file.version } }));
        cacheStats.stored++;
    } catch { writableCache = false; notify(); }
    return bytes;
}
export async function clearModCache() {
    await globalThis.caches?.delete(CACHE); cachePromise = null; writableCache = true;
    cacheStats.hits = cacheStats.downloads = cacheStats.stored = 0; notify();
}
export function finishModPreparation() { notify(); }
export function setupBrowserLibrary(getDisc, onForget = () => {}) {
    const pane = document.getElementById('tab-saves') || document.getElementById('tab-settings');
    if (!pane || document.getElementById('browser-library')) return;
    const group = document.createElement('section'); group.id = 'browser-library'; group.className = 'settings-group';
    const title = document.createElement('h3'); title.textContent = 'Inicio rápido'; group.append(title);
    const label = document.createElement('label'), remember = document.createElement('input'); remember.type = 'checkbox'; remember.checked = shouldRememberDisc();
    label.append(remember, document.createTextNode(' Recordar mi disco en este navegador')); group.append(label);
    const status = document.createElement('p'); status.id = 'disc-storage-status'; status.className = 'ctrl-tip'; status.setAttribute('role', 'status'); group.append(status);
    const usage = document.createElement('p'); usage.className = 'ctrl-tip'; group.append(usage);
    const cacheLine = document.createElement('p'); cacheLine.id = 'resource-cache-status'; cacheLine.className = 'ctrl-tip'; group.append(cacheLine);
    const updateCache = () => {
        cacheLine.dataset.hits = cacheStats.hits; cacheLine.dataset.downloads = cacheStats.downloads;
        cacheLine.textContent = !writableCache ? 'Se reutilizará lo guardado; no hubo espacio para conservar todos los mods.' : cacheStats.hits ? 'Se han reutilizado los mods guardados en este navegador.' : cacheStats.stored ? 'Los mods usados quedan preparados para la próxima visita.' : 'Los mods se guardarán al iniciar el juego, si hay espacio disponible.';
    };
    const refresh = async () => { try { const x = await navigator.storage.estimate(); usage.textContent = 'Espacio usado por el sitio: ' + Math.round((x.usage || 0) / 1048576) + ' MB'; } catch {} };
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-stone'; remove.textContent = 'Quitar copia del disco';
    remove.onclick = async () => { await forgetDisc(); onForget(); status.textContent = 'Copia eliminada. La partida en ejecución se conserva.'; await refresh(); };
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'btn btn-stone'; clear.textContent = 'Liberar caché de mods';
    clear.onclick = async () => { clear.disabled = true; try { await clearModCache(); status.textContent = 'Caché liberada. Tus partidas y tu disco se conservan.'; await refresh(); } finally { clear.disabled = false; } };
    remember.onchange = async () => { localStorage.setItem(PREF, remember.checked ? '1' : '0'); try {
        if (!remember.checked) { await forgetDisc(); onForget(); status.textContent = 'El disco no se recordará en la próxima visita.'; }
        else if (getDisc() instanceof Blob) { await rememberDisc(getDisc()); status.textContent = 'Disco guardado en este navegador.'; }
        else status.textContent = 'Se recordará el próximo disco que selecciones.';
    } catch { status.textContent = 'No hay espacio suficiente para recordar el disco. Puedes jugar igualmente.'; } await refresh(); };
    const note = document.createElement('p'); note.className = 'ctrl-tip'; note.textContent = 'Los mods se reutilizan por versión. Estas opciones no borran tus partidas ni el archivo original del disco.';
    group.append(remove, clear, note); pane.append(group); refresh(); updateCache(); window.addEventListener('yfm-library-change', () => { refresh(); updateCache(); });
}
