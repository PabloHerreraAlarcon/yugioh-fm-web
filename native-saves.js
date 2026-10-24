const KEY = 'yfm_native_saves_v1';
const ROOT = '/game/user';
const encode = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const decode = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export function parseSave(bytes) {
    if (bytes.length === 8192 && bytes[0] === 83 && bytes[1] === 67) return { slot: bytes };
    if (bytes.length === 131072 && bytes[0] === 77 && bytes[1] === 67) return { card: bytes };
    throw new Error('Formato no compatible: usa una partida .sav de 8 KB o una memory card raw .mcd/.mcr/.srm de 128 KB.');
}
export function createSaveStore(storage, getFS, onPersist = () => {}) {
    let failed = false, ready = false, busy = false, detach = () => {};
    const BACKUP = KEY + '_previous';
    let lastPersisted = storage.getItem(KEY);
    const read = () => JSON.parse(storage.getItem(KEY) || '{"version":1,"files":{}}');
    function persist(data) {
        data.files = Object.fromEntries(Object.entries(data.files).sort(([a],[b]) => a.localeCompare(b)));
        const next = JSON.stringify(data), previous = storage.getItem(KEY);
        if (next === previous) { lastPersisted = previous; return; }
        if (previous !== lastPersisted) throw new Error('Otra pestaña actualizó las partidas. Exporta tu partida actual y recarga antes de continuar guardando.');
        // Commit the current version first. A backup quota failure must not undo a save.
        storage.setItem(KEY, next);
        lastPersisted = next;
        try { onPersist(); } catch (error) { console.warn(error); }
        if (previous) { try { storage.setItem(BACKUP, previous); } catch (error) { console.warn('No se pudo actualizar el respaldo anterior:', error); } }
    }
    function snapshot(commit = true) {
        const data = read(), fs = getFS();
        if (fs && ready) {
            function walk(path, relative = '') {
                for (const name of fs.readdir(path)) {
                    if (name === '.' || name === '..') continue;
                    const full = path + '/' + name, rel = relative + name;
                    if (fs.isDir(fs.stat(full).mode)) walk(full, rel + '/');
                    else if (!name.endsWith('.partial')) data.files[rel] = encode(fs.readFile(full));
                }
            }
            if (fs.analyzePath(ROOT + '/saves').exists) {
                for (const name of Object.keys(data.files)) if (name.startsWith('saves/')) delete data.files[name];
                walk(ROOT + '/saves', 'saves/');
            }
            // Mods store chosen skins, decks and settings outside the save-slot folder.
            if (fs.analyzePath(ROOT + '/mod-data').exists) {
                for (const name of Object.keys(data.files)) if (name.startsWith('mod-data/')) delete data.files[name];
                walk(ROOT + '/mod-data', 'mod-data/');
            }
            if (fs.analyzePath('/game/settings.cfg').exists) data.files['engine-settings.cfg'] = encode(fs.readFile('/game/settings.cfg'));
            if (fs.analyzePath('/game/controls.txt').exists) data.files['engine-controls.txt'] = encode(fs.readFile('/game/controls.txt'));
            for (const name of ['settings.txt', 'settings.cfg', 'controls.txt']) {
                if (fs.analyzePath(ROOT + '/' + name).exists) data.files[name] = encode(fs.readFile(ROOT + '/' + name));
            }
            for (let n = 1; n <= 2; n++) {
                const path = `/game/memcard${n}.mcd`;
                if (fs.analyzePath(path).exists) data.files[`memcard${n}.mcd`] = encode(fs.readFile(path));
            }
        }
        if (commit) persist(data);
        return data;
    }
    function restore(fs) {
        ready = false;
        const data = read();
        lastPersisted = storage.getItem(KEY);
        // Read the old browser card without deleting the original key.
        if (!data.files['memcard1.mcd']) {
            const old = storage.getItem('yfm_memcard1') || storage.getItem('yfm_memory_card');
            if (old) { try { if (parseSave(decode(old)).card) data.files['memcard1.mcd'] = old; } catch {} }
        }
        for (const [name, b64] of Object.entries(data.files)) {
            if (name.includes('..') || name.includes('\\') || name.startsWith('/')) throw new Error('Ruta de guardado inválida; no se ha reemplazado el respaldo.');
            if (name === 'engine-controls.txt') { fs.writeFile('/game/controls.txt', decode(b64)); continue; }
            if (name === 'engine-settings.cfg') {
                // Current web mod choices win; preserve audio/controls saved by the engine.
                const current = fs.analyzePath('/game/settings.cfg').exists ? new TextDecoder().decode(fs.readFile('/game/settings.cfg')) : '';
                const restored = new TextDecoder().decode(decode(b64)).split('\n').filter(line => !line.trim().startsWith('mod.'));
                restored.push(...current.split('\n').filter(line => line.trim().startsWith('mod.')));
                fs.writeFile('/game/settings.cfg', new TextEncoder().encode(restored.join('\n')));
                continue;
            }
            const path = /^memcard[12]\.mcd$/.test(name) ? '/game/' + name : ROOT + '/' + name;
            fs.mkdirTree(path.slice(0, path.lastIndexOf('/')));
            fs.writeFile(path, decode(b64));
        }
        ready = true;
        attach(fs);
    }
    function attach(fs) {
        detach();
        const originals = {}, tracked = path => typeof path === 'string' &&
            (path.startsWith(ROOT + '/') || path === '/game/settings.cfg' || path === '/game/controls.txt' || /^\/game\/memcard[12]\.mcd$/.test(path)) && !path.endsWith('.partial');
        function wrap(name, affected) {
            if (typeof fs[name] !== 'function') return;
            const original = originals[name] = fs[name];
            fs[name] = function(...args) {
                const paths = affected(args), result = original.apply(this, args);
                if (!busy && paths.some(tracked)) sync();
                return result;
            };
        }
        wrap('close', ([stream]) => stream && (stream.flags & 3) ? [stream.path] : []);
        wrap('rename', ([from,to]) => [from,to]);
        wrap('unlink', ([path]) => [path]);
        detach = () => { for (const [name,original] of Object.entries(originals)) fs[name] = original; };
    }
    function importBytes(bytes) {
        const parsed = parseSave(bytes), data = snapshot();
        if (parsed.slot) {
            const duplicate = Object.entries(data.files).find(([name, value]) => /^saves\/slot\d\d.sav$/.test(name) && value === encode(bytes));
            if (duplicate) return 'Esta partida ya está importada.';
            let slot = 1;
            while (slot <= 10 && data.files[`saves/slot${String(slot).padStart(2, '0')}.sav`]) slot++;
            if (slot > 10) throw new Error('Las diez ranuras están ocupadas. Exporta un respaldo y libera una desde el juego.');
            const name = `saves/slot${String(slot).padStart(2, '0')}.sav`;
            data.files[name] = encode(bytes);
            persist(data);
            const fs = getFS();
            if (fs) { fs.mkdirTree(ROOT + '/saves'); fs.writeFile(ROOT + '/' + name, bytes); }
            return `Partida importada en la ranura ${slot}. Cierra y vuelve a abrir Cargar partida en el juego.`;
        }
        // Queue a card for the engine's own integrity-checked importer. Never replace slot 1.
        const name = `saves/import-${Date.now()}.mcd`;
        data.files[name] = encode(bytes);
        persist(data);
        const fs = getFS();
        if (fs) { fs.mkdirTree(ROOT + '/saves'); fs.writeFile(ROOT + '/' + name, bytes); }
        return 'Memory card preparada. Abre Cargar partida: el motor verificará sus partidas y las añadirá a las ranuras vacías.';
    }
    function exportFiles(previous = false) {
        const data = previous ? JSON.parse(storage.getItem(BACKUP) || '{"files":{}}') : snapshot(false);
        const slots = Object.entries(data.files).filter(([name]) => /^saves\/slot\d\d.sav$/.test(name));
        if (slots.length) return slots.map(([name, value]) => ({ name: name.split('/').pop(), bytes: decode(value) }));
        const card = data.files['memcard1.mcd'] || (!previous && storage.getItem('yfm_memcard1'));
        if (card) return [{ name: 'memcard1.mcd', bytes: decode(card) }];
        throw new Error(previous ? 'No hay una partida en el respaldo anterior.' : 'Aún no hay partidas guardadas. Guarda desde el menú del juego primero.');
    }
    function sync() {
        if (!ready || busy) return;
        busy = true;
        try { snapshot(); failed = false; }
        catch (error) { if (!failed) { failed = true; console.error('No se pudo conservar la partida:', error); alert('No se pudo guardar en el navegador. Exporta tu partida antes de cerrar.\n' + error.message); } }
        finally { busy = false; }
    }
    return { restore, snapshot, importBytes, exportFiles, sync };
}
