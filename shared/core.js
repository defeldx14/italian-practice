/* Shared, buildless data model. All mutations are immutable, mergeable events. */
(function(g){
 'use strict';
 const FORMAT='italian-hover',VERSION=1,DAY=86400000,MINUTE=60000;
 const str=(v,n,required=false)=>{if(typeof v!=='string'||v.length>n||(required&&!v.trim()))throw Error('Invalid vocabulary text.');return v;};
 function cleanEntry(v){
  if(!v||typeof v!=='object')throw Error('Missing vocabulary entry.');
  const word=str(v.word,100,true),sentence=str(v.sentence,700,true);
  const occurrence=Number.isInteger(v.occurrence)?v.occurrence:-1;
  return {word,translation:str(v.translation??'',6000),sentence,sentenceTranslation:str(v.sentenceTranslation??'',6000),sourceUrl:str(v.sourceUrl??'',3000),sourceTitle:str(v.sourceTitle??'',500),dateAdded:str(v.dateAdded??new Date().toISOString(),40),occurrence,truncated:!!v.truncated};
 }
 function validate(input){
  if(!input||input.format!==FORMAT||input.version!==VERSION||!Array.isArray(input.events)||input.events.length>25000)throw Error('Not a supported Italian Hover v1 backup (maximum 25,000 changes).');
  const events=input.events.map(e=>{
   if(!e||!['put','delete','review'].includes(e.kind))throw Error('Unknown vocabulary change.');
   const o={id:str(e.id,100,true),recordId:str(e.recordId,100,true),kind:e.kind,at:str(e.at,40,true),device:str(e.device,100,true),parents:[]};
   if(!Number.isFinite(Date.parse(o.at)))throw Error('Invalid change date.');
   if(!Array.isArray(e.parents)||e.parents.length>500)throw Error('Invalid change history.');
   o.parents=e.parents.map(p=>str(p,100,true));
   if(e.kind==='put')o.value=cleanEntry(e.value);
   if(e.kind==='review'){
    if(!['word','sentence','cloze'].includes(e.mode)||!['again','hard','good','easy'].includes(e.rating))throw Error('Invalid review.');
    o.mode=e.mode;o.rating=e.rating;
   }
   return o;
  });
  const ids=new Map();for(const e of events){if(ids.has(e.id)&&JSON.stringify(ids.get(e.id))!==JSON.stringify(e))throw Error('Conflicting change IDs in backup.');ids.set(e.id,e);}
  return {format:FORMAT,version:VERSION,events:[...ids.values()].sort(compare)};
 }
 const compare=(a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id);
 function empty(){return {format:FORMAT,version:VERSION,events:[]};}
 function merge(...docs){const events=new Map();for(const d of docs)for(const e of validate(d).events){if(events.has(e.id)&&JSON.stringify(events.get(e.id))!==JSON.stringify(e))throw Error('Conflicting change IDs.');events.set(e.id,e);}return validate({format:FORMAT,version:VERSION,events:[...events.values()]});}
 function project(doc){
  const groups=new Map();
  for(const e of doc.events){if(!groups.has(e.recordId))groups.set(e.recordId,[]);groups.get(e.recordId).push(e);}
  return [...groups].map(([id,events])=>{
   const changes=events.filter(e=>e.kind!=='review'),referenced=new Set(changes.flatMap(e=>e.parents));
   const heads=changes.filter(e=>!referenced.has(e.id)).sort(compare);
   const puts=changes.filter(e=>e.kind==='put').sort(compare),live=heads.filter(e=>e.kind==='put');
   const chosen=live.at(-1)||puts.at(-1),deleted=heads.some(e=>e.kind==='delete');
   const meanings=new Set(live.map(e=>JSON.stringify([e.value.word,e.value.sentence,e.value.translation,e.value.sentenceTranslation])));
   return {id,entry:chosen?.value,heads:heads.map(e=>e.id),variants:heads,deleted,conflict:meanings.size>1||(deleted&&live.length>0),reviews:events.filter(e=>e.kind==='review').sort(compare)};
  }).filter(r=>r.entry).sort((a,b)=>b.entry.dateAdded.localeCompare(a.entry.dateAdded));
 }
 function key(word,sentence){return JSON.stringify([word.normalize('NFC'),sentence.normalize('NFC')]);}
 async function recordId(word,sentence){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key(word,sentence)));return 'v_'+[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
 function event(device,kind,recordId,value={},parents=[]){return {id:crypto.randomUUID(),recordId,kind,device,at:new Date().toISOString(),parents,...value};}
 const isLetter=c=>!!c&&/[\p{L}\p{M}]/u.test(c);
 function cloze(entry){
  const {sentence,word}=entry;const valid=i=>sentence.slice(i,i+word.length)===word&&!isLetter(sentence[i-1])&&!isLetter(sentence[i+word.length]);
  let at=entry.occurrence;
  if(!(Number.isInteger(at)&&at>=0&&valid(at))){const found=[];let i=-1;while((i=sentence.indexOf(word,i+1))!==-1)if(valid(i))found.push(i);if(found.length!==1)return null;at=found[0];}
  return {before:sentence.slice(0,at),after:sentence.slice(at+word.length),answer:word};
 }
 function progress(record,mode){
  let interval=0,due=0,count=0;
  for(const r of record.reviews.filter(r=>r.mode===mode)){
   count++;const t=Date.parse(r.at);
   if(r.rating==='again')interval=10*MINUTE;
   if(r.rating==='hard')interval=interval<DAY?DAY:Math.round(interval*1.2);
   if(r.rating==='good')interval=interval<DAY?DAY:Math.round(interval*2);
   if(r.rating==='easy')interval=interval<DAY?3*DAY:Math.round(interval*3);
   interval=Math.min(interval,365*DAY);due=t+interval;
  }
  return {interval,due,count};
 }
 function eligible(r,mode){return !r.deleted&&!r.conflict&&(mode==='word'?!!r.entry.translation:mode==='sentence'?!!r.entry.sentenceTranslation:!!cloze(r.entry));}
 function queue(doc,mode,now=Date.now(),newOnly=false,options={}){const ids=options.ids?new Set(options.ids):null;const rows=project(doc).filter(r=>eligible(r,mode)&&(!ids||ids.has(r.id))).map(r=>({...r,progress:progress(r,mode)})).filter(r=>options.all|| (newOnly?!r.progress.count:r.progress.due<=now)).sort((a,b)=>(!!a.progress.count===!!b.progress.count?a.progress.due-b.progress.due:a.progress.count? -1:1));if(options.shuffle){const random=options.random||Math.random;for(let i=rows.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}}return rows.slice(0,options.limit===undefined?10:options.limit);}
 function choices(record,records,random=Math.random){const key=s=>s.normalize('NFC').trim().toLocaleLowerCase('it');const seen=new Set([key(record.entry.word)]),others=[];for(const r of records){const k=key(r.entry.word);if(!r.deleted&&!r.conflict&&!seen.has(k)){seen.add(k);others.push(r.entry.word);}}const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};return shuffle([record.entry.word,...shuffle(others).slice(0,3)]);}

 g.ItalianCore={FORMAT,VERSION,DAY,cleanEntry,validate,empty,merge,project,key,recordId,event,cloze,progress,eligible,queue,choices};
})(globalThis);

