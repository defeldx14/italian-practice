const CACHE='parole-shell-v5';
const ASSETS=['./','./index.html','./style.css','./app.js','./config.js','./shared/core.js','./shared/store.js','./shared/drive.js','./manifest.webmanifest','./icons/192.png','./icons/512.png','./privacy.html'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('parole-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 // Never cache OAuth, tokens, Drive requests or user exports.
 if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));
 else e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)));
});
