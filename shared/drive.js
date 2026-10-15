(function(g){
 'use strict';
 const ROOT='https://www.googleapis.com',TAG='italian-hover-v1',SCOPE='https://www.googleapis.com/auth/drive.appdata';
 class Drive {
  constructor(token,request){this.token=token;this.request=request ? (...args)=>request(...args) : (...args)=>globalThis.fetch(...args);}
  async call(path,options={}){
   const c=new AbortController(),timeout=setTimeout(()=>c.abort(),25000);
   try{
    const r=await this.request(ROOT+path,{...options,signal:c.signal,credentials:'omit',headers:{Authorization:`Bearer ${this.token}`,...options.headers}});
    if(!r.ok)throw Error(r.status===401?'Google connection expired. Reconnect and retry.':r.status===403?'Drive access denied. Check Drive API, scope and OAuth setup.':r.status===429?'Drive is busy. Wait and retry.':`Drive error (${r.status}). Retry sync.`);
    return r;
   }catch(e){if(e.name==='AbortError')throw Error('Drive request timed out. Retry sync.');throw e;}finally{clearTimeout(timeout);}
  }
  async list(){
   let page='',files=[];
   do{const q=new URLSearchParams({spaces:'appDataFolder',q:`appProperties has { key='app' and value='${TAG}' } and trashed=false`,fields:'nextPageToken,files(id,name)',pageSize:'1000'});if(page)q.set('pageToken',page);
    const d=await (await this.call('/drive/v3/files?'+q)).json();if(!Array.isArray(d.files))throw Error('Invalid Drive file listing.');files.push(...d.files);page=d.nextPageToken||'';if(files.length>3000)throw Error('Sync journal too large. Export a backup and contact the developer.');
   }while(page);return files;
  }
  async read(file){const r=await this.call('/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media');const text=await r.text();if(text.length>15_000_000)throw Error('Drive file too large.');return ItalianCore.validate(JSON.parse(text));}
  async upload(name,doc,fileId){
   if(fileId)return this.call('/upload/drive/v3/files/'+encodeURIComponent(fileId)+'?uploadType=media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(doc)});
   const boundary='italian_'+crypto.randomUUID(),meta={name,mimeType:'application/json',parents:['appDataFolder'],appProperties:{app:TAG}};
   const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(doc)}\r\n--${boundary}--`;
   return this.call('/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
  }
 }
 async function sync(store,drive,status=()=>{}){
  // Journal before snapshot. Immutable batches remain authoritative after any race.
  status('Reading private Drive journal...');const files=await drive.list();let remote=ItalianCore.empty();
  for(const f of files)remote=ItalianCore.merge(remote,await drive.read(f));
  let local=await store.read();const known=new Set(remote.events.map(e=>e.id)),pending=local.events.filter(e=>!known.has(e.id));
  if(pending.length){status('Uploading saved words and reviews...');await drive.upload('journal-'+crypto.randomUUID()+'.json',{format:ItalianCore.FORMAT,version:1,events:pending});}
  status('Merging device changes...');let merged=await store.change(latest=>ItalianCore.merge(latest,remote));
  const snapshot=files.find(f=>f.name==='italian-vocabulary-v1.json');
  // Snapshot is a convenience, never the sole source of truth.
  const durable=ItalianCore.merge(remote,{format:ItalianCore.FORMAT,version:1,events:pending});
  await drive.upload('italian-vocabulary-v1.json',durable,snapshot?.id);
  const now=new Date().toISOString();await store.set('lastSync',now);
  const durableIds=new Set(durable.events.map(e=>e.id)),remaining=(await store.read()).events.filter(e=>!durableIds.has(e.id)).length;
  status(remaining?'Synced initial changes. New local changes arrived during sync; tap Sync again.':'Synced. Sync the other device to receive these changes.');return {doc:merged,at:now,uploaded:pending.length,remaining};
 }
 g.ItalianDrive={Drive,sync,SCOPE};
})(globalThis);
