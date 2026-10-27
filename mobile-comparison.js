// Explicit local comparison: save writes stay in memory, never in normal storage.
export function testProfile(search = globalThis.location?.search || '') {
 const q=new URLSearchParams(search);
 return q.get('performance')==='1' && ['current','none'].includes(q.get('testmods')) ? q.get('testmods') : null;
}
export function comparisonStorage(storage, profile = testProfile()) {
 if (!profile) return storage;
 const keys=['yfm_native_saves_v1','yfm_native_saves_v1_previous','yfm_memcard1','yfm_memory_card'];
 const values=new Map(keys.map(k=>[k,storage.getItem(k)]));
 return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
}
