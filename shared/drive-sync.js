(function(g){
'use strict';
const API='https://www.googleapis.com';
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function create(o){
 const C=g.DomshopSyncCore,base='domshop.google.'+o.app;
 let account=null,token='',expires=0,running=false,signing=false,initializing=true,applying=false,timer=null,retry=3000,doc=C.empty(o.app),revision=0,message='Connect Google to save automatically.';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const profile=()=>account?.sub||'guest';
 const snapshotKey=()=>base+'.state.'+profile();
 const journalKey=()=>base+'.journal.'+profile();
 const read=(key,fallback)=>{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;};
 function status(text){
  message=text;
  const el=document.getElementById('drive-status');if(el)el.textContent=text;
  document.querySelectorAll('[data-google-status]').forEach(el=>{el.textContent=text;});
 }
 function persist(){localStorage.setItem(journalKey(),JSON.stringify(doc));localStorage.setItem(snapshotKey(),JSON.stringify(o.get()));}
 function seed(items){
  let d=C.capture(C.empty(o.app),items,()=>crypto.randomUUID());
  if(o.initialAt)for(const [k,r]of Object.entries(d.records))r.at=o.initialAt(k,r.value);
  return d;
 }
 function schedule(delay=1500){clearTimeout(timer);if(!token||!account||initializing||running||signing)return;timer=setTimeout(()=>sync().catch(()=>{}),delay);}
 function capture(){
  if(initializing||applying)return;
  const next=C.capture(doc,o.toItems(o.get()),()=>crypto.randomUUID());
  const changed=JSON.stringify(next)!==JSON.stringify(doc);doc=next;persist();
  if(changed){revision++;status(token?'Saving to Google…':account?'Saved offline · reconnect Google to sync.':'Saved on this device · connect Google.');schedule();}
 }
 async function loadProfile(next){
  if(!initializing)capture();
  account=next;token='';expires=0;clearTimeout(timer);
  let state=read(snapshotKey(),account?o.empty():read(base+'.guest-original',o.empty()));
  if(o.loadState)state=await o.loadState(profile(),state);
  state=await o.validate(state);
  const existing=read(journalKey(),null);doc=existing?C.valid(existing,o.app):seed(o.toItems(state));
  applying=true;try{await o.set(clone(state),profile());}finally{applying=false;}
  persist();
  if(account)localStorage.setItem(base+'.selected',JSON.stringify(account));else localStorage.removeItem(base+'.selected');
  revision=0;
  if(!initializing&&o.onProfile)o.onProfile();
  o.refresh();status(account?'Saved offline · reconnect Google.':'Connect Google to save automatically.');
 }
 const ready=(async()=>{
  try{
   if(!localStorage.getItem(base+'.guest-original')){
    const original=clone(o.get());localStorage.setItem(base+'.guest-original',JSON.stringify(original));localStorage.setItem(base+'.state.guest',JSON.stringify(original));
   }
   let selected=read(base+'.selected',null);
   if(selected&&(!/^[A-Za-z0-9_-]{1,128}$/.test(selected.sub||'')||typeof selected.email!=='string'))selected=null;
   await loadProfile(selected);
   initializing=false;
  }catch(e){initializing=false;token='';status('Local profile could not be loaded. Export a backup before reconnecting.');throw e;}
 })();
 ready.catch(()=>{});
 async function call(path,init={}){
  if(!token||Date.now()>=expires){token='';throw Error('Reconnect Google · changes remain saved offline.');}
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),25000);
  try{
   const r=await fetch(API+path,{...init,credentials:'omit',signal:ctrl.signal,headers:{...init.headers,Authorization:'Bearer '+token}});
   if(!r.ok){if(r.status===401)token='';throw Error(r.status===401?'Reconnect Google · changes remain saved offline.':r.status===403?'Google Drive access denied. Check Google setup.':'Google Drive error '+r.status+'. Changes remain saved offline.');}
   return r;
  }finally{clearTimeout(timeout);}
 }
 async function list(){
  let page='',files=[];
  do{
   const q=new URLSearchParams({spaces:'appDataFolder',q:"appProperties has { key='app' and value='"+o.app+"' } and trashed=false",fields:'nextPageToken,files(id,name)',pageSize:'1000'});if(page)q.set('pageToken',page);
   const d=await(await call('/drive/v3/files?'+q)).json();if(!Array.isArray(d.files))throw Error('Invalid Google Drive listing.');
   files.push(...d.files);page=d.nextPageToken||'';if(files.length>3000)throw Error('Sync journal is full. Export a backup and contact Dom.');
  }while(page);return files;
 }
 async function upload(records){
  if(!Object.keys(records).length)return;
  const boundary='domshop_'+crypto.randomUUID(),meta={name:o.app+'-'+crypto.randomUUID()+'.json',mimeType:'application/json',parents:['appDataFolder'],appProperties:{app:o.app}};
  const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify({...C.empty(o.app),records})+'\r\n--'+boundary+'--';
  await call('/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
 }
 async function sync(){
  await ready;
  if(running||signing)return;
  if(!account||!token||Date.now()>=expires){token='';status(account?'Reconnect Google · changes remain saved offline.':'Connect Google to save automatically.');return;}
  if(navigator.onLine===false){status('Offline · changes will sync when you reconnect.');return;}
  running=true;clearTimeout(timer);
  try{
   capture();const before=revision;status('Syncing with Google…');
   if(o.customSync){
    await o.customSync(token,account.sub);
    capture();persist();
   }else{
    let remote=C.empty(o.app);
    for(const file of await list()){
     const text=await(await call('/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media')).text();if(text.length>15000000)throw Error('Drive file too large.');
     remote=C.merge(remote,C.valid(JSON.parse(text),o.app));
    }
    capture();let merged=C.merge(doc,remote);await o.validate(o.fromItems(C.values(merged)));
    const pending={};for(const [k,r]of Object.entries(doc.records)){const p=remote.records[k];if(!p||r.at>p.at||(r.at===p.at&&r.id>p.id))pending[k]=r;}
    await upload(pending);
    capture();merged=C.merge(doc,remote);
    const result=await o.validate(o.fromItems(C.values(merged)));
    applying=true;try{await o.set(result,profile());doc=merged;persist();}finally{applying=false;}
    const durable=C.merge(remote,{...C.empty(o.app),records:pending});
    if(Object.entries(doc.records).some(([k,r])=>r.id!==durable.records[k]?.id))revision++;
   }
   localStorage.setItem(base+'.last.'+profile(),new Date().toISOString());retry=3000;o.refresh();
   status('Saved to Google'+(account.email?' · '+account.email:''));
   if(revision!==before){running=false;schedule();}
  }catch(e){
   if(/connection expired|Reconnect Google/i.test(e.message))token='';
   status(e.name==='AbortError'?'Sync timed out · changes remain saved offline.':e.message);
   running=false;if(token){retry=Math.min(retry*2,300000);schedule(retry);}throw e;
  }finally{running=false;}
 }
 function connect(){
  if(running||signing||initializing)return;
  if(!g.google?.accounts?.oauth2){status('Google sign-in is loading. Check your connection and try again.');if(o.loadGoogle)o.loadGoogle();return;}
  signing=true;token='';clearTimeout(timer);
  const client=g.google.accounts.oauth2.initTokenClient({client_id:o.clientId,scope:g.DomshopGoogle.SCOPES,include_granted_scopes:false,
   callback:async r=>{
    try{
     if(r.error||!r.access_token)throw Error('Google connection was not completed.');
     if(!g.google.accounts.oauth2.hasGrantedAllScopes(r,g.DomshopGoogle.DRIVE_SCOPE))throw Error('Google Drive permission was not granted.');
     const verified=await g.DomshopGoogle.identify(r.access_token);
     await loadProfile(verified);
     token=r.access_token;expires=Date.now()+Math.max(0,(Number(r.expires_in)||3600)-60)*1000;signing=false;
     status('Connected to Google.');o.refresh();await sync();
    }catch(e){signing=false;token='';status(e.message);}
   },
   error_callback:()=>{signing=false;status('Google sign-in was closed or blocked. Try again.');}
  });
  client.requestAccessToken({prompt:'select_account'});
 }
 async function disconnect(){
  await ready;if(running||signing){status('Wait for the current Google operation to finish.');return;}
  await loadProfile(null);status('Google disconnected. Using this device’s unlinked progress.');
 }
 async function importPrevious(){
  await ready;if(!account||!token){status('Connect the intended Google account first.');return;}if(running||signing)return;
  const guest=await o.validate(read(base+'.state.guest',read(base+'.guest-original',o.empty())));
  const merged=C.merge(doc,seed(o.toItems(guest)));
  const state=await o.validate(o.fromItems(C.values(merged)));
  applying=true;try{await o.set(state,profile());doc=merged;persist();}finally{applying=false;}
  revision++;o.refresh();status('Earlier device progress added to this Google account.');schedule(0);
 }
 function panel(){
  const label=account?(account.email||'Google account'):'Not connected';
  let last='';try{last=localStorage.getItem(base+'.last.'+profile())||'';}catch{}
  return '<div class="box"><h2>Google account</h2><p>'+esc(label)+'</p><div class="row"><button type="button" data-drive="connect">'+(account?'Reconnect / switch Google account':'Connect Google')+'</button><button type="button" data-drive="sync">Sync now</button>'+(account?'<button type="button" data-drive="disconnect">Disconnect Google</button>':'')+'</div><p id="drive-status" role="status">'+esc(message)+'</p><small>Automatic saving after changes and when back online. A local copy works offline. Google may ask you to reconnect.'+(last?' Last sync: '+esc(new Date(last).toLocaleString())+'.':'')+'</small>'+(account?'<details><summary>Earlier progress on this device</summary><p>Only add it if it belongs to this Google account.</p><button type="button" data-drive="import-previous">Add earlier device progress to this account</button></details>':'')+'</div>';
 }
 document.addEventListener('click',e=>{
  const action=e.target.closest('[data-drive]')?.dataset.drive;
  if(action==='connect')connect();
  if(action==='disconnect')disconnect().catch(e=>status(e.message));
  if(action==='sync')sync().catch(e=>status(e.message));
  if(action==='import-previous')importPrevious().catch(e=>status(e.message));
 });
 window.addEventListener('online',()=>schedule(0));
 window.addEventListener('offline',()=>status('Offline · changes stay on this device until Google reconnects.'));
 window.addEventListener('focus',()=>schedule(0));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0);});
 setInterval(()=>{if(!document.hidden){if(token&&Date.now()>=expires){token='';status('Reconnect Google · changes remain saved offline.');}else schedule(0);}},60000);
 return {ready,capture,panel,sync,connect,disconnect,importPrevious};
}
g.DomshopDriveSync={create};
})(globalThis);
