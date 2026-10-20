(function(g){
'use strict';
const FORMAT='domshop-registers', forbidden=k=>['__proto__','prototype','constructor'].includes(k);
function empty(app){return {format:FORMAT,version:1,app,records:{}}}
function valid(doc,app){
 if(!doc||doc.format!==FORMAT||doc.version!==1||doc.app!==app||!doc.records||Array.isArray(doc.records)||typeof doc.records!=='object'||Object.keys(doc.records).length>30000)throw Error('Invalid sync data.');
 for(const [k,r]of Object.entries(doc.records)){if(forbidden(k)||k.length>500||!r||!Number.isSafeInteger(r.at)||r.at<0||typeof r.id!=='string'||r.id.length>100||typeof r.deleted!=='boolean'||(!r.deleted&&!Object.hasOwn(r,'value')))throw Error('Invalid sync record.')}
 return doc;
}
function merge(a,b){
 valid(a,a.app);valid(b,a.app);const out=empty(a.app);
 for(const source of [a,b])for(const [k,r]of Object.entries(source.records)){const p=out.records[k];if(!p||r.at>p.at||(r.at===p.at&&r.id>p.id))out.records[k]=r;}
 return out;
}
function capture(doc,items,id,now=Date.now()){
 valid(doc,doc.app);const out=merge(empty(doc.app),doc);
 let time=Math.max(now,...Object.values(doc.records).map(r=>r.at))+1;
 for(const k of new Set([...Object.keys(items),...Object.keys(doc.records)])){
 const p=doc.records[k],exists=Object.hasOwn(items,k);
 if(exists&&(!p||p.deleted||JSON.stringify(p.value)!==JSON.stringify(items[k])))out.records[k]={at:time++,id:id(),deleted:false,value:items[k]};
 else if(!exists&&p&&!p.deleted)out.records[k]={at:time++,id:id(),deleted:true};
 }return out;
}
function values(doc){const out={};for(const [k,r]of Object.entries(doc.records))if(!r.deleted)out[k]=r.value;return out}
g.DomshopSyncCore={empty,valid,merge,capture,values};
})(globalThis);
