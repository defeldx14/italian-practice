(function(g){
'use strict';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.appdata';
const SCOPES='openid email '+DRIVE_SCOPE;
async function identify(token){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),25000);
 try{
  const r=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token},credentials:'omit',signal:c.signal});
  if(!r.ok)throw Error('Could not verify this Google account. Reconnect Google.');
  const p=await r.json();
  if(typeof p.sub!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(p.sub))throw Error('Google did not return a valid account ID.');
  return {sub:p.sub,email:typeof p.email==='string'?p.email:''};
 }finally{clearTimeout(timer);}
}
g.DomshopGoogle={DRIVE_SCOPE,SCOPES,identify};
})(globalThis);
