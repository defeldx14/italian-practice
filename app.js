/* No build step, no embedded credentials, no HTML interpolation of saved text. */
(() => {
 'use strict';
 const C=ItalianCore,$=id=>document.getElementById(id),ext=location.protocol==='chrome-extension:';
 let doc=C.empty(),mode='word',session=[],cursor=0,editId=null,editEntry=null,editHeads=[],token='',expiry=0,gisReady=false,tokenClient=null,busy=false,sessionMode='word',selectedWords=new Set(),quizAnswered=false,lastSessionIds=[],answerEpoch=0;
 const sentenceCache=new Map(),sentenceRequests=new Map();
 let S=ItalianStore,driveSync=null,drivePanel=null;
 const guestStore=ItalianStore;
 const notify=t=>$('notice').textContent=t;
 function make(tag,text,parent,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;parent?.append(e);return e;}
 function action(text,parent,fn,cls='secondary'){const e=make('button',text,parent,cls);e.type='button';e.onclick=()=>Promise.resolve().then(fn).catch(e=>notify(e.message));return e;}
 function tab(name){if(name==='grammar')renderGrammar();document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==name);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));location.hash=name;}
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
 document.querySelector('.brand').onclick=e=>{e.preventDefault();tab('today');};
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));end();refresh();});
 function queueOptions(all=false){return {all,shuffle:true,limit:$('sessionSize').value==='all'?Infinity:Number($('sessionSize').value)||Infinity,ids:$('wordSet').value==='custom'?[...selectedWords]:null};}
 function practiceQueue(newOnly=false,all=false){return C.queue(doc,mode==='choice'?'cloze':mode,Date.now(),newOnly,queueOptions(all));}
 function picker(){const q=$('pickSearch').value.toLocaleLowerCase();$('pickList').replaceChildren();const rows=C.project(doc).filter(r=>!r.deleted&&!r.conflict&&[r.entry.word,r.entry.translation,r.entry.sentence].join(' ').toLocaleLowerCase().includes(q));for(const r of rows){const label=make('label',undefined,$('pickList'),'check'),check=make('input',undefined,label);check.type='checkbox';check.checked=selectedWords.has(r.id);check.onchange=()=>{if(check.checked)selectedWords.add(r.id);else selectedWords.delete(r.id);selectionChanged();};make('span',r.entry.word+' — '+r.entry.sentence,label);} $('pickCount').textContent=selectedWords.size+' selected';}
 function selectionChanged(){S.set('practiceSelection',[...selectedWords]);refresh();}
 $('wordSet').onchange=()=>{$('wordPicker').hidden=$('wordSet').value!=='custom';picker();refresh();};$('sessionSize').onchange=()=>{S.set('practiceSize',$('sessionSize').value);refresh();};$('pickSearch').oninput=picker;
 $('pickAll').onclick=()=>{const q=$('pickSearch').value.toLocaleLowerCase();for(const r of C.project(doc))if(!r.deleted&&!r.conflict&&[r.entry.word,r.entry.translation,r.entry.sentence].join(' ').toLocaleLowerCase().includes(q))selectedWords.add(r.id);selectionChanged();};$('pickNone').onclick=()=>{selectedWords.clear();selectionChanged();};
 async function refresh(){
  const target=S,latest=await target.read();if(target!==S)return;doc=latest;const records=C.project(doc),live=records.filter(r=>!r.deleted),available=live.filter(r=>C.eligible(r,mode==='choice'?'cloze':mode));
  $('wordCount').textContent=live.length;
  $('dueCount').textContent=available.filter(r=>{const p=C.progress(r,mode==='choice'?'cloze':mode);return p.count&&p.due<=Date.now();}).length;
  $('newCount').textContent=available.filter(r=>!C.progress(r,mode==='choice'?'cloze':mode).count).length;
  const today=new Date().toDateString();$('reviewCount').textContent=doc.events.filter(e=>e.kind==='review'&&new Date(e.at).toDateString()===today).length;
  const eligible=available.length;$('startReview').disabled=!practiceQueue().length;$('startNew').disabled=!practiceQueue(true).length;
  $('readyText').textContent=!live.length?'Save your first word with Italian Hover, or import a backup.':!eligible?'No cards ready for this mode. Add missing translations or resolve conflicts in My words.':`${eligible} ${eligible===1?'entry':'entries'} available for this mode. Choose all words or a session size above.`;
  $('startAll').disabled=!practiceQueue(false,true).length;picker();renderLibrary();if(location.hash==='#grammar')renderGrammar();const last=await S.get('lastSync','');$('lastSync').textContent=last?'Last successful sync: '+new Date(last).toLocaleString():'';
 }
 function start(newOnly,all=false){session=practiceQueue(newOnly,all);if(session.length>1&&session.map(r=>r.id).join('|')===lastSessionIds.join('|')){const offset=1+Math.floor(Math.random()*(session.length-1));session.push(...session.splice(0,offset));}lastSessionIds=session.map(r=>r.id);sessionMode=mode;cursor=0;if(!session.length){notify('No cards due in this mode. Try new words or another mode.');return;}$('startPanel').hidden=true;$('today').classList.toggle('reviewing',true);$('study').hidden=false;card();}
 function end(){answerEpoch++;$('study').classList.toggle('rating-visible',false);$('today').classList.toggle('reviewing',false);$('study').hidden=true;$('startPanel').hidden=false;session=[];cursor=0;}
 function card(){
  if(cursor>=session.length){notify('Session complete. Your reviews are saved on this device. Sync to send progress to your other device.');end();refresh();return;}
  $('study').scrollIntoView?.({block:'start',behavior:'instant'});
  const r=session[cursor],e=r.entry;$('cardPosition').textContent=`${cursor+1} / ${session.length} · ${sessionMode==='choice'?'SENTENCE QUIZ':sessionMode==='cloze'?'MISSING WORD':sessionMode==='sentence'?'SENTENCE RECALL':'WORD RECALL'}`;
  $('study').classList.toggle('rating-visible',false);
  answerEpoch++;$('sentenceEnglish').hidden=true;$('sentenceEnglish').textContent='';$('retrySentence').hidden=true;
  quizAnswered=false;$('quizChoices').replaceChildren();$('quizFeedback').textContent='';$('quizNext').hidden=true;
  $('answerPanel').hidden=true;$('reveal').hidden=false;$('question').replaceChildren();$('context').textContent='';$('clozeInput').hidden=sessionMode!=='cloze';$('clozeInput').value='';
  if(sessionMode==='word'){$('cardInstruction').textContent='';$('question').textContent=e.word;$('context').textContent=e.sentence;$('answer').textContent=e.translation;$('answerContext').textContent=e.sentenceTranslation;}
  if(sessionMode==='sentence'){$('cardInstruction').textContent='Read the sentence. Can you explain it in English?';$('question').textContent=e.sentence;$('answer').textContent=e.sentenceTranslation;$('answerContext').textContent=e.word+(e.translation?' — '+e.translation:'');}
  if(sessionMode==='cloze'||sessionMode==='choice'){const c=C.cloze(e);if(!c){cursor++;card();return;}$('cardInstruction').textContent='Complete the original Italian sentence.';make('span',c.before,$('question'));make('span',' ______ ',$('question'));make('span',c.after,$('question'));$('context').textContent=e.sentenceTranslation||'Recall the missing word from your reading.';$('answer').textContent=e.word;$('answerContext').textContent=e.sentence;
   if(sessionMode==='choice'){$('clozeInput').hidden=true;$('reveal').hidden=true;$('context').textContent='';$('cardInstruction').textContent='Choose the word or phrase saved from this sentence.';const options=C.choices(r,C.project(doc).filter(x=>$('wordSet').value!=='custom'||selectedWords.has(x.id)));if(options.length<2){$('quizFeedback').textContent='Add another distinct word for multiple choice. Reveal and self-rate this card.';$('reveal').hidden=false;}else for(const option of options)action(option.toLocaleLowerCase('it'),$('quizChoices'),()=>{if(quizAnswered)return;quizAnswered=true;const correct=option===e.word;$('quizFeedback').textContent=correct?'Correct — '+e.word+(e.translation?': '+e.translation:''):'Saved answer: '+e.word+(e.translation?' — '+e.translation:'');$('quizFeedback').dataset.result=correct?'correct':'incorrect';$('answerPanel').hidden=false;document.querySelectorAll('[data-rating]').forEach(b=>b.hidden=true);$('quizNext').hidden=false;showAnswerSentence(r);for(const b of $('quizChoices').children){b.disabled=true;if(b.textContent===e.word.toLocaleLowerCase('it'))b.className='quiz-correct';else if(b.textContent===option.toLocaleLowerCase('it'))b.className='quiz-incorrect';}});}
  }
  if(sessionMode!=='choice'||!quizAnswered)document.querySelectorAll('[data-rating]').forEach(b=>b.hidden=false);
 }
 $('startAll').onclick=()=>start(false,true);
 $('quizNext').onclick=async()=>{if(!quizAnswered||$('quizNext').disabled)return;$('quizNext').disabled=true;const r=session[cursor],rating=$('quizFeedback').dataset.result==='correct'?'good':'again',device=await S.device();$('quizNext').disabled=true;try{await S.change(d=>{const live=C.project(d).find(x=>x.id===r.id);if(!live||live.deleted||live.conflict)throw Error('This entry changed. End the session and check My words.');d.events.push(C.event(device,'review',r.id,{mode:'cloze',rating}));return d;});cursor++;card();await refresh();}catch(e){notify(e.message);}finally{$('quizNext').disabled=false;}};
 document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target?.tagName)&&!e.target?.isContentEditable&&!$('study').hidden&&!$('quizNext').hidden){e.preventDefault();if(!$('quizNext').disabled)$('quizNext').onclick();}});
 $('startReview').onclick=()=>start(false);$('startNew').onclick=()=>start(true);$('endSession').onclick=end;
 $('reveal').onclick=()=>{$('answerPanel').hidden=false;$('reveal').hidden=true;$('study').classList.toggle('rating-visible',true);if(sessionMode==='choice')showAnswerSentence(session[cursor]);};
 document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=async()=>{
  if($('answerPanel').hidden||!session[cursor])return;
  const r=session[cursor],device=await S.device();document.querySelectorAll('[data-rating]').forEach(x=>x.disabled=true);
  try{await S.change(d=>{const current=C.project(d).find(x=>x.id===r.id);if(!current||current.deleted)throw Error('This card was deleted. Refresh your library.');if(current.conflict)throw Error('This word has conflicting edits. End the session and resolve it in My words.');d.events.push(C.event(device,'review',r.id,{mode:sessionMode==='choice'?'cloze':sessionMode,rating:b.dataset.rating}));return d;});cursor++;card();await refresh();}
  catch(e){notify(e.message);}finally{document.querySelectorAll('[data-rating]').forEach(x=>x.disabled=false);}
 });
 async function sentenceTranslation(record,target=S){
  const original=record.entry.sentence;
  const latest=C.project(await target.read()).find(r=>r.id===record.id);
  if(!latest||latest.deleted||latest.conflict||latest.entry.sentence!==original)throw Error('Entry changed. Check My words.');
  if(latest.entry.sentenceTranslation)return latest.entry.sentenceTranslation;
  if(!navigator.onLine)throw Error('Offline. Retry when connected.');
  const key=(target.database||'local')+'\n'+record.id+'\n'+original;
  let pending=sentenceRequests.get(key);
  if(!pending){
   pending=(async()=>{
    let translation=sentenceCache.get(original);
    if(!translation){
     if(ext){
      const response=await chrome.runtime.sendMessage({type:'translate',id:crypto.randomUUID(),kind:'sentence',word:record.entry.word,sentence:original});
      if(response?.error)throw Error(response.error);translation=response?.data?.translation;
     }else{
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
      try{
       const url=new URL('https://translate.googleapis.com/translate_a/single');
       url.search=new URLSearchParams({client:'gtx',sl:'it',tl:'en',dt:'t',q:original}).toString();
       const response=await fetch(url.href,{signal:controller.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
       if(!response.ok)throw Error(response.status===429?'Google is rate-limiting translations. Retry later.':'Google translation unavailable. Retry later.');
       const data=await response.json();if(!Array.isArray(data?.[0]))throw Error('Translation unavailable.');
       translation=data[0].filter(row=>Array.isArray(row)&&typeof row[0]==='string').map(row=>row[0]).join('').trim();
      }finally{clearTimeout(timeout);}
     }
     if(typeof translation!=='string'||!translation.trim()||translation.length>6000)throw Error('Translation unavailable.');
     sentenceCache.set(original,translation);if(sentenceCache.size>250)sentenceCache.delete(sentenceCache.keys().next().value);
    }
    if(target!==S)throw Error('Google account changed. Retry in the intended account.');
    // Fill only an empty field, retaining concurrent manual edits and deletions.
    await target.fillTranslation(record.id,record.entry.word,original,'sentenceTranslation',translation);
    const saved=C.project(await target.read()).find(r=>r.id===record.id);
    if(!saved||saved.deleted||saved.conflict||saved.entry.sentence!==original||!saved.entry.sentenceTranslation)throw Error('Entry changed. Check My words.');
    return saved.entry.sentenceTranslation;
   })();sentenceRequests.set(key,pending);
   pending.finally(()=>sentenceRequests.delete(key)).catch(()=>{});
  }
  return pending;
 }
 async function showAnswerSentence(record){
  const epoch=answerEpoch,target=S;
  const current=()=>epoch===answerEpoch&&target===S&&!$('study').hidden&&!$('answerPanel').hidden;
  $('sentenceEnglish').hidden=false;$('sentenceEnglish').textContent=record.entry.sentenceTranslation||'Translating sentence…';$('retrySentence').hidden=true;
  if(record.entry.sentenceTranslation)return;
  try{
   const translation=await sentenceTranslation(record,target);
   if(current()){$('sentenceEnglish').textContent=translation;record.entry.sentenceTranslation=translation;}
   if(target===S)await refresh();
  }catch(e){if(current()){$('sentenceEnglish').textContent='Sentence translation not saved. '+(e.name==='AbortError'?'Request timed out.':e.message);$('retrySentence').hidden=false;}}
 }
 $('retrySentence').onclick=()=>{const record=session[cursor];if(record)showAnswerSentence(record);};

 const builtTargets={presente:'prendo',passato_prossimo:'preso',imperfetto:'prendevo',futuro:'prenderò',condizionale:'prenderei',congiuntivo:'prenda',imperativo:'Prendi',infinito:'prendere',gerundio:'prendendo',participio_passato:'preso'};\n const grammarForms=[["presente","Presente","Now, regularly, or generally.","Di solito prendo il caffè al bar.","I usually have coffee at the café."],["passato_prossimo","Passato prossimo","A completed past event: avere or essere + past participle.","Ieri ho preso il treno.","Yesterday I took the train."],["imperfetto","Imperfetto","A past habit, description, or action in progress.","Da piccolo prendevo il treno ogni settimana.","As a child, I took the train every week."],["futuro","Futuro semplice","A future action or prediction.","Domani prenderò il treno.","Tomorrow I will take the train."],["condizionale","Condizionale","Would; often used for wishes or polite requests.","Prenderei un caffè, per favore.","I would have a coffee, please."],["congiuntivo","Congiuntivo presente","Often follows doubt, emotion, opinion, or a wish about another subject.","Spero che tu prenda il treno.","I hope that you take the train."],["imperativo","Imperativo","A command or instruction.","Prendi il treno delle otto.","Take the eight o’clock train."],["infinito","Infinito","The dictionary form: the verb’s name.","Voglio prendere il treno.","I want to take the train."],["gerundio","Gerundio","Often used with stare to describe an action in progress.","Sto prendendo il treno.","I am taking the train."],["participio_passato","Participio passato","The past participle, used with avere or essere in compound tenses.","Ho preso il treno.","I took the train."]];
 let grammarQuiz=null,grammarRevealed=false;
 function renderGrammar(){
  const root=$('grammarContent');if(!root)return;root.replaceChildren();
  const intro=make('div',undefined,root,'panel grammar-panel');
  make('h2','Verb forms at a glance',intro);
  make('p','Think of each form as answering a different question: when does it happen, and how does the speaker present it?',intro,'muted');
  const grid=make('div',undefined,intro,'grammar-grid');
  for(const f of grammarForms){const card=make('article',undefined,grid,'grammar-card');make('h3',f[1],card);make('p',f[2],card,'muted');make('p',f[3],card,'grammar-it');make('p',f[4],card,'grammar-en');}
  const practice=make('section',undefined,root,'panel grammar-panel');
  make('h2','Practice: name the form',practice);
  make('p','Read the sentence and choose the form used by the highlighted verb. The English translation stays hidden until you check.',practice,'muted');
  const builtIn=grammarForms.map(f=>({sentence:f[3],english:f[4],form:f[0],word:builtTargets[f[0]],origin:'Parola example'}));
  const linked=C.project(doc).filter(r=>!r.deleted&&!r.conflict&&r.entry.grammarForm&&grammarForms.some(f=>f[0]===r.entry.grammarForm)).map(r=>({sentence:r.entry.sentence,english:r.entry.sentenceTranslation,form:r.entry.grammarForm,word:r.entry.word,lemma:r.entry.lemma,origin:r.entry.lemma?'Your word · '+r.entry.lemma:'Your saved word'}));
  const pool=[...builtIn,...linked];
  const question=grammarQuiz||pool[Math.floor(Math.random()*pool.length)];
  grammarQuiz=question;
  const prompt=make('div',undefined,practice,'grammar-question');
  const qText=question.sentence,at=qText.toLocaleLowerCase('it').indexOf((question.word||'').toLocaleLowerCase('it'));if(at>=0){make('span',qText.slice(0,at),prompt);make('strong',qText.slice(at,at+question.word.length),prompt,'grammar-highlight');make('span',qText.slice(at+question.word.length),prompt);}else make('p',qText,prompt,'grammar-it');
  const choices=make('div',undefined,practice,'grammar-choices');
  const feedback=make('p',undefined,practice,'grammar-feedback');feedback.id='grammarFeedback';
  for(const f of grammarForms){const b=make('button',f[1],choices);b.type='button';b.onclick=()=>{if(grammarRevealed)return;grammarRevealed=true;const ok=f[0]===question.form;feedback.textContent=(ok?'Correct. ':'Not quite. ')+grammarForms.find(x=>x[0]===question.form)[1]+(question.lemma?' · infinitive: '+question.lemma:'');feedback.dataset.correct=String(ok);const reveal=$('grammarTranslation');if(reveal)reveal.hidden=false;choices.querySelectorAll('button').forEach(x=>{x.disabled=true;if(x.textContent===grammarForms.find(y=>y[0]===question.form)[1])x.classList.add('grammar-right');});};}
  const translation=make('p',question.english||'No English translation saved for this sentence.',practice,'grammar-en');translation.id='grammarTranslation';translation.hidden=true;
  const next=make('button','Next sentence',practice,'primary');next.type='button';next.onclick=()=>{grammarQuiz=pool[Math.floor(Math.random()*pool.length)];grammarRevealed=false;renderGrammar();};
  const linker=make('section',undefined,root,'panel grammar-panel');
  make('h2','Build your infinitive library',linker);
  make('p','Choose one of your saved entries, connect its exact form to the dictionary infinitive, and label the form used in its sentence. Parola keeps the original word and sentence; entries with the same infinitive appear together and join this quiz.',linker,'muted');
  const live=C.project(doc).filter(r=>!r.deleted&&!r.conflict);
  const select=make('select',undefined,linker);select.setAttribute('aria-label','Saved vocabulary entry');
  make('option','Choose a saved word or phrase…',select).value='';
  for(const r of live){const o=make('option',r.entry.word+' — '+r.entry.sentence,select);o.value=r.id;}
  const lemma=make('input',undefined,linker);lemma.type='text';lemma.placeholder='Dictionary infinitive, e.g. mettere';lemma.setAttribute('aria-label','Dictionary infinitive');
  const formSelect=make('select',undefined,linker);formSelect.setAttribute('aria-label','Verb form in the saved sentence');
  make('option','Choose the form shown in the sentence…',formSelect).value='';
  for(const f of grammarForms){const o=make('option',f[1],formSelect);o.value=f[0];}
  select.onchange=()=>{const r=live.find(x=>x.id===select.value);if(r){lemma.value=r.entry.lemma||'';formSelect.value=r.entry.grammarForm||'';}};
  const save=make('button','Link saved entry',linker,'primary');save.type='button';save.onclick=async()=>{try{const r=live.find(x=>x.id===select.value);const canonical=lemma.value.trim().toLocaleLowerCase('it');if(!r)throw Error('Choose a saved entry first.');if(!/^[a-zàèéìòù]+(si)?$/iu.test(canonical))throw Error('Enter one Italian infinitive, such as mettere or mettersi.');if(!formSelect.value)throw Error('Choose the form you see in the saved sentence.');await S.edit(r.id,{...r.entry,lemma:canonical,grammarForm:formSelect.value},'put',r.heads);grammarQuiz=null;notify('Linked '+r.entry.word+' to '+canonical+'.');await refresh();renderGrammar();}catch(e){notify(e.message);}};
  const groups=new Map();for(const r of live){const key=(r.entry.lemma||'').trim().toLocaleLowerCase('it');if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  const grouped=make('div',undefined,linker,'infinitive-groups');
  if(!groups.size)make('p','No infinitives linked yet. Start with forms you have already saved, such as messo → mettere.',grouped,'muted');
  for(const [key,items] of [...groups].sort((a,b)=>a[0].localeCompare(b[0],'it'))){const article=make('article',undefined,grouped,'infinitive-group');make('h3',key,article);for(const r of items){make('p',r.entry.word+' · '+(grammarForms.find(f=>f[0]===r.entry.grammarForm)?.[1]||'form not labeled'),article);make('p',r.entry.sentence,article,'grammar-it');}}
 }
 function renderLibrary(){
  const q=$('search').value.toLocaleLowerCase(),all=C.project(doc),rows=all.filter(r=>(!r.deleted||$('showDeleted').checked)&&[r.entry.word,r.entry.translation,r.entry.sentence,r.entry.sentenceTranslation].join(' ').toLocaleLowerCase().includes(q));
  $('entries').replaceChildren();$('librarySummary').textContent=`${rows.length} matching entries${all.some(r=>r.conflict)?' · Conflicts need your choice before practice.':''}`;
  if(!rows.length){make('p','No entries here yet. Save words from an Italian page or import your JSON backup.',$('entries'),'muted');return;}
  for(const r of rows){
   const e=r.entry,article=make('article',undefined,$('entries'),'entry');make('h2',e.word,article);make('div',e.translation||'English meaning not saved',article,'meaning');make('p',e.sentence,article,'it');make('p',e.sentenceTranslation||'Sentence translation not saved',article,'en');
   const source=make('div',undefined,article,'source');let valid;
   try{valid=new URL(e.sourceUrl);if(!['https:','http:'].includes(valid.protocol))valid=null;}catch{}
   if(valid){const a=make('a',e.sourceTitle||valid.hostname,source);a.href=valid.href;a.target='_blank';a.rel='noreferrer noopener';}
   make('span',' · '+new Date(e.dateAdded).toLocaleDateString(),source);
   if(e.truncated)make('p','Saved sentence is a bounded excerpt.',article,'muted');
   if(r.conflict)make('p','Conflicting edits preserved. Open Resolve to choose or combine them.',article,'warning');
   if(r.deleted)make('p','Deleted — excluded from practice. Old history is retained for sync.',article,'warning');
   const actions=make('div',undefined,article,'actions');action(r.conflict?'Resolve':'Edit',actions,()=>openEditor(r));
   if(!r.deleted){action('Delete',actions,async()=>{if(confirm('Delete this entry from practice on all synced devices?')){await S.edit(r.id,null,'delete',r.heads);await refresh();}});}
   else action('Restore',actions,()=>openEditor(r));
   if(!e.sentenceTranslation&&!r.deleted&&!r.conflict)action('Translate sentence',actions,async()=>{
    notify('Translating and saving sentence…');await sentenceTranslation(r);notify('Sentence translation saved.');await refresh();
   });
  }
 }
 $('search').oninput=renderLibrary;$('showDeleted').onchange=renderLibrary;
 function fill(e){$('editWord').value=e.word;$('editTranslation').value=e.translation;$('editSentence').value=e.sentence;$('editSentenceTranslation').value=e.sentenceTranslation;$('editOccurrence').value=e.occurrence;}
 // Separate manual defaults avoid validation until the form is submitted.
 function openEditor(r){
  editId=r?.id||null;editHeads=r?.heads||[];editEntry=r?.entry||{word:'',translation:'',sentence:'',sentenceTranslation:'',sourceUrl:'',sourceTitle:'',dateAdded:new Date().toISOString(),occurrence:-1,truncated:false};
  $('editorTitle').textContent=r?.deleted?'Restore word':r?.conflict?'Resolve edits':r?'Edit word':'Add a word';$('editError').textContent='';$('variants').replaceChildren();$('conflictInfo').textContent=r?.conflict?'Every version remains in history. Choose a version below, edit if needed, then Save entry to resolve all current versions.':'';
  if(r?.conflict)for(const v of r.variants){if(v.kind==='put')action(v.value.word+' — '+v.value.translation+'\n'+v.value.sentenceTranslation,$('variants'),()=>fill(v.value));else make('p','One device deleted this entry. Close and leave deleted, or Save entry to restore.',$('variants'),'warning');}
  fill(editEntry);$('editor').showModal();
 }
 let bulkRows=null,bulkText='',bulkStore=null,bulkBusy=false,bulkEpoch=0;
 function resetBulk(){bulkEpoch++;bulkRows=null;bulkStore=null;$('bulkImport').disabled=true;$('bulkResults').replaceChildren();$('bulkStatus').textContent='';}
 $('bulkOpen').onclick=()=>{$('bulkPanel').hidden=!$('bulkPanel').hidden;if(!$('bulkPanel').hidden)$('bulkText').focus?.();};
 $('bulkText').oninput=resetBulk;
 $('bulkPreview').onclick=async()=>{
  if(bulkBusy)return;resetBulk();const epoch=bulkEpoch,target=S,text=$('bulkText').value;
  $('bulkPreview').disabled=true;
  try{
   const rows=await ItalianBulk.preview(text,await target.read());if(epoch!==bulkEpoch||target!==S||text!==$('bulkText').value)return;
   bulkRows=rows;bulkText=text;bulkStore=target;
   const ready=rows.filter(r=>r.status==='ready').length,duplicates=rows.filter(r=>r.status==='duplicate').length,invalid=rows.filter(r=>r.status==='invalid').length;
   $('bulkStatus').textContent=ready+' ready · '+duplicates+' duplicates skipped · '+invalid+' invalid lines';
   for(const row of rows){const line=make('div',undefined,$('bulkResults'),'bulk-row');make('strong','Line '+row.line+': '+(row.value?.word||'Invalid entry'),line);make('span',row.status==='ready'?'Ready':row.status==='duplicate'?'Skipped':'Fix this line',line);if(row.value){make('p',row.value.translation,line);make('p',row.value.sentence,line);if(row.value.sentenceTranslation)make('p',row.value.sentenceTranslation,line);}if(row.message)make('p',row.message,line,'muted');}
   $('bulkImport').textContent='Import '+ready+' valid '+(ready===1?'entry':'entries');$('bulkImport').disabled=!ready;
  }catch(e){$('bulkStatus').textContent=e.message;}finally{$('bulkPreview').disabled=false;}
 };
 $('bulkImport').onclick=async()=>{
  if(bulkBusy||!bulkRows||bulkText!==$('bulkText').value||bulkStore!==S){if(!bulkBusy)$('bulkStatus').textContent='Preview your list again before importing.';return;}
  bulkBusy=true;$('bulkImport').disabled=true;$('bulkPreview').disabled=true;$('bulkText').disabled=true;const target=bulkStore,rows=bulkRows;
  try{
   const result=await ItalianBulk.commit(target,rows,()=>target===S);
   if(target===S){bulkRows=null;$('bulkStatus').textContent=result.added+' added · '+result.skipped+' duplicates skipped · '+result.invalid+' invalid lines not imported. Your words are saved locally.';notify(result.added+' words imported.');await refresh();}
  }catch(e){$('bulkStatus').textContent='Nothing imported: '+e.message+' Preview again to retry.';bulkRows=null;}
  finally{bulkBusy=false;$('bulkPreview').disabled=false;$('bulkText').disabled=false;}
 };

 $('addManual').onclick=()=>openEditor(null);$('closeEditor').onclick=()=>$('editor').close();
 $('editForm').onsubmit=async ev=>{ev.preventDefault();try{
  const value=C.cleanEntry({...editEntry,word:$('editWord').value,translation:$('editTranslation').value,sentence:$('editSentence').value,sentenceTranslation:$('editSentenceTranslation').value,lemma:editEntry.lemma||'',grammarForm:editEntry.grammarForm||'',occurrence:Number($('editOccurrence').value)});
  if(editId)await S.edit(editId,value,'put',editHeads);else {const result=await S.capture(value);notify(result.status);}
  $('editor').close();await refresh();
 }catch(e){$('editError').textContent=e.message;}};
 $('export').onclick=async()=>{try{const blob=new Blob([JSON.stringify(C.validate(await S.read()),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='italian-vocabulary-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);notify('Backup exported. On iPhone use the browser download or Share → Save to Files.');}catch(e){notify(e.message);}};
 $('import').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{if(f.size>15_000_000)throw Error('Backup is too large (15 MB maximum).');const imported=C.validate(JSON.parse(await f.text()));await S.importDoc(imported);notify('Backup merged, including reviews and deletion history.');await refresh();}catch(e){notify('Import failed: '+e.message);}finally{ev.target.value='';}};
 // Web uses Google's supported browser token model; extension uses Chrome identity.
 async function loadGIS(){if(ext||gisReady)return;if(!navigator.onLine){$('syncStatus').textContent='Offline. Local study remains available.';return;}
  if(document.getElementById('google-gis'))return;
  const script=document.createElement('script');script.id='google-gis';script.src='https://accounts.google.com/gsi/client';script.async=true;
  script.onload=()=>{gisReady=true;buildTokenClient();};script.onerror=()=>{$('syncStatus').textContent='Google sign-in could not load. Retry Connect when online.';script.remove();};document.head.append(script);
 }
 function buildTokenClient(){const client=$('clientId').value.trim();if(!gisReady||!client)return;tokenClient=google.accounts.oauth2.initTokenClient({client_id:client,scope:ItalianDrive.SCOPE,include_granted_scopes:false,callback:async r=>{if(r.error){$('syncStatus').textContent='Google authorization failed: '+r.error;return;}if(!google.accounts.oauth2.hasGrantedAllScopes(r,ItalianDrive.SCOPE)){$('syncStatus').textContent='App-data permission was not granted.';return;}token=r.access_token;expiry=Date.now()+Number(r.expires_in||3500)*1000;$('connection').textContent='Drive connected';await doSync();},error_callback:e=>{$('syncStatus').textContent='Google sign-in closed or blocked. Allow the popup and tap Connect again.';}});}
 $('saveClient').onclick=async()=>{const id=$('clientId').value.trim();if(!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id)){notify('Enter a public web OAuth client ID, not a client secret.');return;}await S.set('webClientId',id);token='';tokenClient=null;await loadGIS();buildTokenClient();notify('Public client ID saved. Tick the account confirmation, then Connect.');};
 async function extensionToken(){
  const manifest=chrome.runtime.getManifest();if(!manifest.oauth2?.client_id)throw Error('Configure the Chrome-extension OAuth client in manifest.json first. See SYNC-SETUP.md.');
  const allowed=await chrome.permissions.request({permissions:['identity'],origins:['https://www.googleapis.com/*']});if(!allowed)throw Error('Drive sync permission was not granted.');
  const result=await chrome.identity.getAuthToken({interactive:true,scopes:[ItalianDrive.SCOPE]});return typeof result==='string'?result:result.token;
 }
 $('connect').onclick=()=>{
  if(!$('accountConsent').checked){notify('Confirm the intended Google account before merging this library.');return;}
  if(ext){extensionToken().then(t=>{token=t;expiry=Date.now()+3500_000;$('connection').textContent='Drive connected';return doSync();}).catch(e=>$('syncStatus').textContent=e.message);return;}
  if(!gisReady){loadGIS();$('syncStatus').textContent='Loading Google sign-in. Tap Connect again in a moment.';return;}
  if(!tokenClient){buildTokenClient();if(!tokenClient){$('syncStatus').textContent='Save your web OAuth client ID first.';return;}}
  // Directly inside the tap handler to preserve Safari popup authorization.
  tokenClient.requestAccessToken({prompt:'select_account'});
 };
 async function doSync(){
  if(busy)return;if(!token||Date.now()>=expiry){token='';$('connection').textContent='Reconnect Drive';$('syncStatus').textContent='Tap Connect Google Drive to authorize this session.';return;}
  busy=true;$('sync').disabled=true;$('connect').disabled=true;
  try{await ItalianDrive.sync(S,new ItalianDrive.Drive(token),t=>$('syncStatus').textContent=t);await refresh();}
  catch(e){$('syncStatus').textContent=e.message+' Your local data is still saved. Retry Sync or reconnect.';}
  finally{busy=false;$('sync').disabled=false;$('connect').disabled=false;}
 }
 $('sync').onclick=()=>{if(!$('accountConsent').checked){notify('Confirm your intended Google account first.');return;}doSync();};
 $('disconnect').onclick=async()=>{if(busy){notify('Wait for the current sync to finish.');return;}if(ext&&token)await chrome.identity.removeCachedAuthToken({token}).catch(()=>{});token='';expiry=0;$('accountConsent').checked=false;$('connection').textContent='Local mode';$('syncStatus').textContent='Disconnected here. Local data and remote backups remain. Revoke app access in Google account settings if desired.';};
 $('persist').onclick=async()=>{const ok=await navigator.storage?.persist?.();notify(ok?'Persistent local storage granted. Keep backups too.':'This browser did not grant persistent storage. Export backups regularly.');};
 async function boot(){
  try{await S.open();selectedWords=new Set(await S.get('practiceSelection',[]));$('sessionSize').value=await S.get('practiceSize','all');$('wordSet').value='all';await refresh();const estimate=await navigator.storage?.estimate?.();if(estimate)$('storageInfo').textContent='Local storage used: '+Math.ceil((estimate.usage||0)/1024)+' KB. Keep regular JSON backups.';
   $('clientId').value=await S.get('webClientId',globalThis.PAROLE_CONFIG?.webClientId||'');
   $('clientLabel').hidden=ext;$('saveClient').hidden=ext;$('syncSetup').textContent=ext?'Chrome identity uses your extension OAuth client configured in manifest.json. Setup instructions are in SYNC-SETUP.md.':'Enter your public web OAuth client ID once. See SYNC-SETUP.md for Google Cloud setup. This does not enable billing.';
   if(ext){$('offlineInfo').textContent='This extension library is stored on your computer and works offline. Use the separate GitHub Pages app on your iPhone.';$('persist').hidden=true;}
   else if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>$('offlineInfo').textContent='Offline app shell is ready on this browser. In Safari use Share → Add to Home Screen; open that installed app online once too.').catch(e=>$('offlineInfo').textContent='Offline setup failed: '+e.message);}
   
   if(!ext){
    const oldPanel=$('clientLabel').closest('.panel');oldPanel.hidden=true;$('connection').hidden=true;
    drivePanel=document.createElement('div');oldPanel.before(drivePanel);
    driveSync=DomshopDriveSync.create({
     app:'domshop-parola-v1',clientId:globalThis.PAROLE_CONFIG.webClientId,empty:C.empty,get:()=>doc,
     toItems:d=>Object.fromEntries(C.validate(d).events.map(e=>['event/'+e.id,e])),
     fromItems:items=>C.validate({format:C.FORMAT,version:1,events:Object.entries(items).filter(([key])=>key.startsWith('event/')).map(([,e])=>e)}),
     loadState:async(profile,fallback)=>{const target=profile==='guest'?guestStore:guestStore.forAccount(profile);return target.get('data',fallback);},
     validate:C.validate,initialAt:(key,e)=>Date.parse(e.at)||0,
     set:async(d,profile)=>{S=profile==='guest'?guestStore:guestStore.forAccount(profile);await S.set('data',C.validate(d));doc=d;},
     customSync:async t=>{const target=S;await ItalianDrive.sync(target,new ItalianDrive.Drive(t),()=>{});if(target!==S)throw Error('Google account changed during sync.');doc=await target.read();},
     onProfile:()=>{resetBulk();$('bulkPanel').hidden=true;selectedWords=new Set();$('wordSet').value='all';$('wordPicker').hidden=true;end();if($('editor').open)$('editor').close();},
     refresh:()=>{refresh().catch(e=>notify(e.message));if(drivePanel&&driveSync)drivePanel.innerHTML=driveSync.panel();},
     loadGoogle:loadGIS
    });
    await driveSync.ready;drivePanel.innerHTML=driveSync.panel();
    $('accountConsent').checked=false;
    window.addEventListener('domshop-parola-change',async e=>{
     const target=S;if(e.detail?.database!==target.database)return;
     try{const fresh=await target.read();if(target!==S)return;doc=fresh;driveSync.capture();await refresh();}catch(err){notify('Local save needs attention: '+err.message);}
    });
   }

   tab(['today','library','grammar','settings'].includes(location.hash.slice(1))?location.hash.slice(1):'today');
   if(!ext&&$('clientId').value)loadGIS();
  }catch(e){notify('Local storage unavailable: '+e.message+'. Enable site storage and retry; existing data has not been cleared.');}
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh().catch(e=>notify(e.message));});
 window.addEventListener('online',()=>{if(!ext&&$('clientId').value)loadGIS();});boot();
})();


