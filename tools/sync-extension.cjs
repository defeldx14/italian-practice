// Rebuild the extension overlay from the same app source. Run with node; no dependencies.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),app=fs.existsSync(path.join(root,'app.js'))?root:path.join(root,'parola');
for(const file of ['app.js','index.html','style.css','shared/bulk.js','shared/core.js']){
 let text=fs.readFileSync(path.join(app,file),'utf8');
 if(file==='index.html')text=text.replace(/<div class="google-save-status"[\s\S]*?<\/div>/,'').replace(/<script src="shared\/(?:sync-core|google-account|drive-sync)\.js[^"]*"><\/script>/g,'').replace(/(src|href)="([^"]+)\?v=\d+"/g,'$1="$2"');
 const destination=path.join(root,'extension-update','app',file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,text);
}
console.log('Extension overlay updated from shared app source.');
