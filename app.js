/* No build step, no embedded credentials, no HTML interpolation of saved text. */
(() => {
 'use strict';
 const C=ItalianCore,$=id=>document.getElementById(id),ext=location.protocol==='chrome-extension:';
 let doc=C.empty(),mode='word',session=[],cursor=0,editId=null,editEntry=null,editHeads=[],token='',expiry=0,gisReady=false,tokenClient=null,busy=false,sessionMode='word',selectedWords=new Set(),quizAnswered=false;
 let S=ItalianStore,driveSync=null,drivePanel=null;
 const guestStore=ItalianStore;
 const notify=t=>$('notice').textContent=t;
 function make(tag,text,parent,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;parent?.append(e);return e;}
 function action(text,parent,fn,cls='secondary'){const e=make('button',text,parent,cls);e.type='button';e.onclick=()=>Promise.resolve().then(fn).catch(e=>notify(e.message));return e;}
 function tab(name){document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==name);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));location.hash=name;}
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
 document.querySelector('.brand').onclick=e=>{e.preventDefault();tab('today');};
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));end();refresh();});
 function queueOptions(all=false){return {all,limit:$('sessionSize').value==='all'?Infinity:Number($('sessionSize').value)||Infinity,ids:$('wordSet').value==='custom'?[...selectedWords]:null};}
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
  $('startAll').disabled=!practiceQueue(false,true).length;picker();renderLibrary();const last=await S.get('lastSync','');$('lastSync').textContent=last?'Last successful sync: '+new Date(last).toLocaleString():'';
 }
 function start(newOnly,all=false){session=practiceQueue(newOnly,all);sessionMode=mode;cursor=0;if(!session.length){notify('No cards due in this mode. Try new words or another mode.');return;}$('startPanel').hidden=true;$('today').classList.toggle('reviewing',true);$('study').hidden=false;card();}
 function end(){$('today').classList.toggle('reviewing',false);$('study').hidden=true;$('startPanel').hidden=false;session=[];cursor=0;}
 function card(){
  if(cursor>=session.length){notify('Session complete. Your reviews are saved on this device. Sync to send progress to your other device.');end();refresh();return;}
  $('study').scrollIntoView?.({block:'start',behavior:'instant'});
  const r=session[cursor],e=r.entry;$('cardPosition').textContent=`${cursor+1} / ${session.length} · ${sessionMode==='choice'?'SENTENCE QUIZ':sessionMode==='cloze'?'MISSING WORD':sessionMode==='sentence'?'SENTENCE RECALL':'WORD RECALL'}`;
  quizAnswered=false;$('quizChoices').replaceChildren();$('quizFeedback').textContent='';$('quizNext').hidden=true;
  $('answerPanel').hidden=true;$('reveal').hidden=false;$('question').replaceChildren();$('context').textContent='';$('clozeInput').hidden=sessionMode!=='cloze';$('clozeInput').value='';
  if(sessionMode==='word'){$('cardInstruction').textContent='Recall the English meaning.';$('question').textContent=e.word;$('context').textContent=e.sentence;$('answer').textContent=e.translation;$('answerContext').textContent=e.sentenceTranslation;}
  if(sessionMode==='sentence'){$('cardInstruction').textContent='Read the sentence. Can you explain it in English?';$('question').textContent=e.sentence;$('answer').textContent=e.sentenceTranslation;$('answerContext').textContent=e.word+(e.translation?' — '+e.translation:'');}
  if(sessionMode==='cloze'||sessionMode==='choice'){const c=C.cloze(e);if(!c){cursor++;card();return;}$('cardInstruction').textContent='Complete the original Italian sentence.';make('span',c.before,$('question'));make('span',' ______ ',$('question'));make('span',c.after,$('question'));$('context').textContent=e.sentenceTranslation||'Recall the missing word from your reading.';$('answer').textContent=e.word;$('answerContext').textContent=e.sentence;
   if(sessionMode==='choice'){$('clozeInput').hidden=true;$('reveal').hidden=true;$('context').textContent='';$('cardInstruction').textContent='Choose the word or phrase saved from this sentence.';const options=C.choices(r,C.project(doc).filter(x=>$('wordSet').value!=='custom'||selectedWords.has(x.id)));if(options.length<2){$('quizFeedback').textContent='Add another distinct word for multiple choice. Reveal and self-rate this card.';$('reveal').hidden=false;}else for(const option of options)action(option,$('quizChoices'),()=>{if(quizAnswered)return;quizAnswered=true;const correct=option===e.word;$('quizFeedback').textContent=correct?'Correct — '+e.word+(e.translation?': '+e.translation:''):'Saved answer: '+e.word+(e.translation?' — '+e.translation:'');$('quizFeedback').dataset.result=correct?'correct':'incorrect';$('answerPanel').hidden=false;document.querySelectorAll('[data-rating]').forEach(b=>b.hidden=true);$('quizNext').hidden=false;for(const b of $('quizChoices').children){b.disabled=true;if(b.textContent===e.word)b.className='quiz-correct';else if(b.textContent===option)b.className='quiz-incorrect';}});}
  }
  if(sessionMode!=='choice'||!quizAnswered)document.querySelectorAll('[data-rating]').forEach(b=>b.hidden=false);
 }
 $('startAll').onclick=()=>start(false,true);
 $('quizNext').onclick=async()=>{if(!quizAnswered||$('quizNext').disabled)return;$('quizNext').disabled=true;const r=session[cursor],rating=$('quizFeedback').dataset.result==='correct'?'good':'again',device=await S.device();$('quizNext').disabled=true;try{await S.change(d=>{const live=C.project(d).find(x=>x.id===r.id);if(!live||live.deleted||live.conflict)throw Error('This entry changed. End the session and check My words.');d.events.push(C.event(device,'review',r.id,{mode:'cloze',rating}));return d;});cursor++;card();await refresh();}catch(e){notify(e.message);}finally{$('quizNext').disabled=false;}};
 document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target?.tagName)&&!e.target?.isContentEditable&&!$('study').hidden&&!$('quizNext').hidden){e.preventDefault();if(!$('quizNext').disabled)$('quizNext').onclick();}});
 $('startReview').onclick=()=>start(false);$('startNew').onclick=()=>start(true);$('endSession').onclick=end;
 $('reveal').onclick=()=>{$('answerPanel').hidden=false;$('reveal').hidden=true;};
 document.querySelectorAll('[data-rating]').forEach(b=>b.onclick=async()=>{
  if($('answerPanel').hidden||!session[cursor])return;
  const r=session[cursor],device=await S.device();document.querySelectorAll('[data-rating]').forEach(x=>x.disabled=true);
  try{await S.change(d=>{const current=C.project(d).find(x=>x.id===r.id);if(!current||current.deleted)throw Error('This card was deleted. Refresh your library.');if(current.conflict)throw Error('This word has conflicting edits. End the session and resolve it in My words.');d.events.push(C.event(device,'review',r.id,{mode:sessionMode==='choice'?'cloze':sessionMode,rating:b.dataset.rating}));return d;});cursor++;card();await refresh();}
  catch(e){notify(e.message);}finally{document.querySelectorAll('[data-rating]').forEach(x=>x.disabled=false);}
 });
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
   if(ext&&!e.sentenceTranslation&&!r.deleted&&!r.conflict)action('Translate sentence',actions,async()=>{
    notify('Requesting sentence translation from Google...');const response=await chrome.runtime.sendMessage({type:'translate',id:crypto.randomUUID(),kind:'sentence',word:e.word,sentence:e.sentence});if(response?.error)throw Error(response.error);if(!response?.data?.translation)throw Error('Translation unavailable.');await S.translateSaved(r.id,e.sentence,response.data.translation);notify('Sentence translation saved.');await refresh();
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
 $('addManual').onclick=()=>openEditor(null);$('closeEditor').onclick=()=>$('editor').close();
 $('editForm').onsubmit=async ev=>{ev.preventDefault();try{
  const value=C.cleanEntry({...editEntry,word:$('editWord').value,translation:$('editTranslation').value,sentence:$('editSentence').value,sentenceTranslation:$('editSentenceTranslation').value,occurrence:Number($('editOccurrence').value)});
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
     onProfile:()=>{selectedWords=new Set();$('wordSet').value='all';$('wordPicker').hidden=true;end();if($('editor').open)$('editor').close();},
     refresh:()=>{refresh().catch(e=>notify(e.message));if(drivePanel&&driveSync)drivePanel.innerHTML=driveSync.panel();},
     loadGoogle:loadGIS
    });
    await driveSync.ready;drivePanel.innerHTML=driveSync.panel();
    $('accountConsent').checked=false;
    window.addEventListener('domshop-parola-change',async e=>{
     const target=S;if(e.detail?.database!==target.database)return;
     try{const fresh=await target.read();if(target!==S)return;doc=fresh;driveSync.capture();}catch(err){notify('Local save needs attention: '+err.message);}
    });
   }

   tab(['today','library','settings'].includes(location.hash.slice(1))?location.hash.slice(1):'today');
   if(!ext&&$('clientId').value)loadGIS();
  }catch(e){notify('Local storage unavailable: '+e.message+'. Enable site storage and retry; existing data has not been cleared.');}
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh().catch(e=>notify(e.message));});
 window.addEventListener('online',()=>{if(!ext&&$('clientId').value)loadGIS();});boot();
})();

