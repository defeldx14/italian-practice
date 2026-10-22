// Executes the real controller/importer with mocked DOM and storage; no provider calls.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=fs.existsSync(path.join(__dirname,'..','app.js'))?path.join(__dirname,'..'):path.join(__dirname,'..','parola');
class El{constructor(){this.children=[];this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.checked=false;this.dataset={};this.classList={toggle(){}};}append(e){this.children.push(e);}replaceChildren(){this.children=[];}closest(){return new El();}before(){}showModal(){}close(){}focus(){}}
test('paste, preview, import valid rows, invalidate edited paste and skip duplicates',async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),els=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new El()]));
 const document={hidden:false,head:new El(),getElementById:id=>els[id],createElement:()=>new El(),addEventListener(){},querySelector:()=>new El(),querySelectorAll:q=>q==='.view'?[els.today,els.library,els.settings]:[]};
 const ctx=vm.createContext({document,window:{addEventListener(){}},location:{protocol:'https:',hash:''},navigator:{onLine:false,storage:{}},crypto:require('node:crypto').webcrypto,TextEncoder,URL,URLSearchParams,console,Blob,AbortController,setTimeout,clearTimeout});
 for(const name of ['core','bulk'])vm.runInContext(fs.readFileSync(path.join(root,'shared',name+'.js'),'utf8'),ctx);
 const C=ctx.ItalianCore;let data=C.empty(),writes=0;
 ctx.ItalianStore={open:async()=>{},read:async()=>structuredClone(data),get:async(k,v)=>v,set:async()=>{},device:async()=>'test',change:async fn=>{data=C.validate(fn(structuredClone(data)));writes++;}};
 ctx.ItalianDrive={SCOPE:'drive.appdata'};ctx.PAROLE_CONFIG={webClientId:''};ctx.DomshopDriveSync={create:()=>({ready:Promise.resolve(),panel:()=>'',capture(){}})};
 vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),ctx);const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};await flush();
 els.bulkText.value='caffè | coffee | Il caffè è pronto. | The coffee is ready.\nmano d’opera | workforce | La mano d’opera costa.\nBAD\ncaffè | coffee | Il caffè è pronto. | The coffee is ready.';
 await els.bulkPreview.onclick();assert.match(els.bulkStatus.textContent,/2 ready/);assert.match(els.bulkStatus.textContent,/1 invalid/);assert.equal(els.bulkImport.disabled,false);
 els.bulkText.oninput();assert.equal(els.bulkImport.disabled,true);await els.bulkImport.onclick();assert.equal(writes,0);
 await els.bulkPreview.onclick();await els.bulkImport.onclick();await flush();assert.equal(writes,1);assert.equal(C.project(data).length,2);assert.match(els.bulkStatus.textContent,/2 added/);assert.equal(els.bulkImport.disabled,true);
 await els.bulkPreview.onclick();assert.equal(els.bulkImport.disabled,true);assert.match(els.bulkStatus.textContent,/0 ready/);assert.ok(C.project(data).some(r=>r.entry.sentenceTranslation==='The coffee is ready.'));
});
