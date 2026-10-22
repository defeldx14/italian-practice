(function(g){
 'use strict';
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('domshop-parola-storage'):null;
 channel?.addEventListener('message',e=>{if(typeof e.data?.database==='string')g.dispatchEvent(new CustomEvent('domshop-parola-change',{detail:{database:e.data.database}}));});
 function makeStore(name='italian-hover-vocabulary'){
 let opening;
 function open(){return opening??=new Promise((resolve,reject)=>{
  const r=indexedDB.open(name,1);
  r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });}
 async function get(key,fallback){const db=await open();return new Promise((resolve,reject)=>{const r=db.transaction('kv').objectStore('kv').get(key);r.onsuccess=()=>resolve(r.result??fallback);r.onerror=()=>reject(r.error);});}
 async function mutate(key,fn,fallback){const db=await open();return new Promise((resolve,reject)=>{
  const tx=db.transaction('kv','readwrite'),s=tx.objectStore('kv'),r=s.get(key);let value,changed=false;
  r.onsuccess=()=>{try{const before=JSON.stringify(r.result??fallback);value=fn(r.result??fallback);changed=JSON.stringify(value)!==before;s.put(value,key);}catch(e){reject(e);tx.abort();}};
  tx.oncomplete=()=>{resolve(value);if(key==='data'&&changed&&g.dispatchEvent&&typeof CustomEvent==='function'){g.dispatchEvent(new CustomEvent('domshop-parola-change',{detail:{database:name}}));channel?.postMessage({database:name});}};tx.onerror=()=>reject(tx.error||Error('Unable to save locally.'));tx.onabort=()=>reject(tx.error||Error('Local save cancelled.'));
 });}
 const set=(key,value)=>mutate(key,()=>value);
 const read=()=>get('data',ItalianCore.empty());
 const change=fn=>mutate('data',d=>ItalianCore.validate(fn(ItalianCore.validate(d))),ItalianCore.empty());
 async function device(){return mutate('device',id=>id||crypto.randomUUID(),'');}
 async function capture(value){
  value=ItalianCore.cleanEntry(value);const id=await ItalianCore.recordId(value.word,value.sentence),dev=await device();let status='Saved';
  const doc=await change(d=>{
   const existing=ItalianCore.project(d).find(r=>ItalianCore.key(r.entry.word,r.entry.sentence)===ItalianCore.key(value.word,value.sentence)||r.id===id);
   if(existing){status=existing.deleted?'Previously deleted - restore in library':'Already saved';return d;}
   d.events.push(ItalianCore.event(dev,'put',id,{value}));return d;
  });return {id,status,count:ItalianCore.project(doc).filter(r=>!r.deleted).length};
 }
 async function edit(id,value,kind='put',expectedHeads){
  const dev=await device();return change(d=>{
   const r=ItalianCore.project(d).find(r=>r.id===id);if(!r)throw Error('Entry not found.');
   if(kind==='put'){
    value=ItalianCore.cleanEntry(value);
    if(ItalianCore.project(d).some(o=>o.id!==id&&!o.deleted&&ItalianCore.key(o.entry.word,o.entry.sentence)===ItalianCore.key(value.word,value.sentence)))throw Error('That word and sentence already exist.');
   }
   d.events.push(ItalianCore.event(dev,kind,id,kind==='put'?{value}:{},expectedHeads||r.heads));return d;
  });
 }
 async function translateSaved(id,sentence,translation){return change(d=>{
  const r=ItalianCore.project(d).find(r=>r.id===id);if(!r||r.deleted||r.conflict||r.entry.sentence!==sentence) return d;
  d.events.push(ItalianCore.event('translation','put',id,{value:{...r.entry,sentenceTranslation:translation}},r.heads));return d;
 });}
 async function fillTranslation(id,word,sentence,field,translation){
  if(!['translation','sentenceTranslation'].includes(field)||typeof translation!=='string'||translation.length>6000)throw Error('Invalid translation field.');
  return change(d=>{
   const r=ItalianCore.project(d).find(r=>r.id===id);
   if(!r||r.deleted||r.conflict||r.entry.word!==word||r.entry.sentence!==sentence||r.entry[field])return d;
   d.events.push(ItalianCore.event('translation','put',id,{value:{...r.entry,[field]:translation}},r.heads));return d;
  });
 }
 return {database:name,open,get,set,mutate,read,change,device,capture,edit,translateSaved,fillTranslation,importDoc:d=>change(local=>ItalianCore.merge(local,d))};
}
 const stores=new Map();g.ItalianStore=makeStore();
 g.ItalianStore.forAccount=id=>{if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('Invalid Google account ID.');if(!stores.has(id))stores.set(id,makeStore('italian-hover-vocabulary.google.'+id));return stores.get(id);};
})(globalThis);
