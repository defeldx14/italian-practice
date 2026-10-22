/* Plain-text vocabulary import. No provider calls, HTML parsing or invented fields. */
(function(g){
 'use strict';
 const C=g.ItalianCore,MAX_ROWS=1000,MAX_TEXT=2000000;
 function parse(text){
  if(typeof text!=='string'||text.length>MAX_TEXT)throw Error('Paste at most 2 million characters.');
  const rows=[];
  for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
   const line=raw.trim();if(!line||/^```/.test(line))continue;
   if(rows.length>=MAX_ROWS)throw Error('Import at most 1,000 entries at a time.');
   const row={line:index+1,raw,status:'ready',message:''};rows.push(row);
   try{
    const fields=line.split(line.includes('\t')?'\t':'|').map(s=>s.trim());
    if(fields.length<3||fields.length>4)throw Error('Use Italian | English meaning | Italian sentence | English sentence (last field optional).');
    const [word,translation,sentence,sentenceTranslation='']=fields;
    if(!translation)throw Error('English meaning is required.');
    const value=C.cleanEntry({word,translation,sentence,sentenceTranslation,sourceTitle:'Pasted vocabulary',sourceUrl:'',dateAdded:new Date().toISOString(),occurrence:-1});
    // Keep the pasted spelling; locate the first exact whole-word/phrase occurrence.
    let at=-1;while((at=sentence.indexOf(word,at+1))!==-1){const found=C.cloze({...value,occurrence:at});if(found&&found.before.length===at){value.occurrence=at;break;}}
    row.value=value;
    if(!C.cloze(value))row.message='Saved for recall; sentence quizzes need an exact, unambiguous occurrence of the Italian word.';
   }catch(e){row.status='invalid';row.message=e.message;}
  }
  return rows;
 }
 function existing(doc){const result=new Map();for(const r of C.project(doc)){const key=C.key(r.entry.word,r.entry.sentence);result.set(key,r.deleted?'Previously deleted; restore it in My words.':'Already saved.');}return result;}
 async function preview(text,doc){
  const rows=parse(text),known=existing(doc);
  for(const row of rows){if(row.status==='invalid')continue;const key=C.key(row.value.word,row.value.sentence);if(known.has(key)){row.status='duplicate';row.message=known.get(key);}else{row.id=await C.recordId(row.value.word,row.value.sentence);known.set(key,'Repeated in this paste.');}}
  return rows;
 }
 async function commit(store,rows,stillCurrent=()=>true){
  if(!Array.isArray(rows)||rows.length>MAX_ROWS)throw Error('Invalid import preview.');
  const ready=rows.filter(r=>r.status==='ready'),device=await store.device();let summary;
  await store.change(doc=>{
   if(!stillCurrent())throw Error('Account changed. Preview again in the intended account.');
   const known=existing(doc),ids=new Set(C.project(doc).map(r=>r.id));summary={added:0,skipped:0,invalid:rows.filter(r=>r.status==='invalid').length};
   for(const row of ready){const value=C.cleanEntry(row.value),key=C.key(value.word,value.sentence);if(known.has(key)||ids.has(row.id)){summary.skipped++;continue;}
    doc.events.push(C.event(device,'put',row.id,{value}));known.set(key,'Added');ids.add(row.id);summary.added++;
   }
   summary.skipped+=rows.filter(r=>r.status==='duplicate').length;
   // The store validates atomically, including the event-history limit.
   return doc;
  });return summary;
 }
 g.ItalianBulk={parse,preview,commit,MAX_ROWS};
})(globalThis);
