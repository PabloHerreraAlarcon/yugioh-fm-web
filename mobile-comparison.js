// Explicit local comparison: save writes stay in memory, never in normal storage.
export function testProfile(search = globalThis.location?.search || '') {
 const q=new URLSearchParams(search);
 return q.get('performance')==='1' && ['current','none','no-table','no-2d','no-cutins'].includes(q.get('testmods')) ? q.get('testmods') : null;
}
export function comparisonStorage(storage, profile = testProfile()) {
 if (!profile) return storage;
 const keys=['yfm_native_saves_v1','yfm_native_saves_v1_previous','yfm_memcard1','yfm_memory_card'];
 const values=new Map(keys.map(k=>[k,storage.getItem(k)]));
 return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
}

export function excludedTestMod(id, profile = testProfile()) {
 return profile === 'none' || ({'no-table':'simon-at-table-hd','no-2d':'duel-links-2d-arts','no-cutins':'anime-duel-cutins'}[profile] === id);
}
export function comparisonLabel(profile = testProfile()) {
 return {current:'Tus mods actuales',none:'Sin mods','no-table':'Tus mods sin mesa HD','no-2d':'Tus mods sin cartas 2D','no-cutins':'Tus mods sin Anime Duel Cutins'}[profile] || '';
}
