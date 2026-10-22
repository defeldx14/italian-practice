const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=fs.existsSync(path.join(__dirname,'..','app.js'))?path.join(__dirname,'..'):path.join(__dirname,'..','parola');
const context=vm.createContext({crypto:require('node:crypto').webcrypto,TextEncoder});
for(const name of ['core','bulk'])vm.runInContext(fs.readFileSync(path.join(root,'shared',name+'.js'),'utf8'),context);
const C=context.ItalianCore,B=context.ItalianBulk;
function store(){let doc=C.empty(),writes=0;return {device:async()=>'test',read:async()=>structuredClone(doc),change:async fn=>{doc=C.validate(fn(structuredClone(doc)));writes++;},writes:()=>writes};}
test('accents, phrases, repeated occurrence, optional translation and invalid rows',()=>{
 const rows=B.parse("caffè | coffee | Il caffè è pronto. | The coffee is ready.\nmano d’opera | workforce | La mano d’opera costa. | Labor costs money.\ncasa | house | La casa e la casa.\ninvalid\nletto | bed | Dormo qui.");
 assert.equal(rows.length,5);assert.equal(rows[0].value.occurrence,3);assert.equal(rows[1].value.occurrence,3);assert.equal(rows[2].value.occurrence,3);assert.equal(rows[2].value.sentenceTranslation,'');assert.equal(rows[3].status,'invalid');assert.ok(rows[4].message);assert.equal(C.cloze(rows[4].value),null);
 assert.equal(B.parse('casa\thouse\tLa casa è grande.')[0].status,'ready');
 assert.equal(B.parse('```text\ncasa | house | La casa è grande.\n```').length,1);
 assert.throws(()=>B.parse('x'.repeat(2000001)));assert.throws(()=>B.parse(('casa | house | La casa.\n').repeat(1001)));
});
test('atomic 1000-entry import, repeat import, tombstones and roundtrip',async()=>{
 const s=store(),text=Array.from({length:1000},(_,i)=>`voce${i} | meaning ${i} | La voce${i} arriva. | The item arrives.`).join('\n');
 const rows=await B.preview(text,await s.read()),result=await B.commit(s,rows);
 assert.equal(result.added,1000);assert.equal(s.writes(),1);assert.equal(C.project(await s.read()).length,1000);
 const copy=await B.preview(text,await s.read());assert.ok(copy.every(r=>r.status==='duplicate'));assert.equal((await B.commit(s,copy)).added,0);
 const d=await s.read(),first=C.project(d)[0];await s.change(doc=>{doc.events.push(C.event('test','delete',first.id,{},first.heads));return doc;});
 const deleted=await B.preview(`${first.entry.word} | meaning | ${first.entry.sentence}`,await s.read());assert.equal(deleted[0].status,'duplicate');assert.match(deleted[0].message,/deleted/);await B.commit(s,deleted);assert.equal(C.project(await s.read()).find(r=>r.id===first.id).deleted,true);
 const json=C.validate(JSON.parse(JSON.stringify(await s.read())));assert.equal(C.merge(json,json).events.length,json.events.length);
});
test('partial validity, duplicate paste, concurrent import and account guard',async()=>{
 const s=store(),text='casa | house | La casa è grande.\ncasa | house | La casa è grande.\nBAD\ncasa | home | Torno a casa.';
 const a=await B.preview(text,await s.read());assert.equal(a.filter(r=>r.status==='ready').length,2);assert.equal(a.filter(r=>r.status==='duplicate').length,1);
 const b=await B.preview(text,await s.read());await B.commit(s,b);const result=await B.commit(s,a);assert.equal(result.added,0);assert.equal(result.skipped,3);assert.equal(result.invalid,1);assert.equal(C.project(await s.read()).length,2);
 const next=await B.preview('strada | road | La strada è lunga.',await s.read());await assert.rejects(B.commit(s,next,()=>false),/Account changed/);assert.equal(C.project(await s.read()).length,2);
});
test('untrusted markup is plain text and missing fields are not invented',()=>{
 const r=B.parse('<img src=x onerror=alert(1)> | tag | Un tag: <img src=x onerror=alert(1)>')[0];assert.equal(r.status,'ready');assert.equal(r.value.sentenceTranslation,'');assert.equal(r.value.sourceUrl,'');assert.equal(r.value.word,'<img src=x onerror=alert(1)>');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),js=fs.readFileSync(path.join(root,'app.js'),'utf8');assert.ok(html.includes('id="bulkText"'));const section=js.slice(js.indexOf(' let bulkRows='),js.indexOf(" $('addManual').onclick"));assert.ok(!/innerHTML|fetch\(|chrome\.runtime/.test(section));
});
