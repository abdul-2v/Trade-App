const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync('lib/postcodeLookup.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',js)(mod,mod.exports,require);
const {lookupUkPostcode}=mod.exports;

async function test(){
 const previous=global.fetch,urls=[];
 try{
  global.fetch=async(url)=>{urls.push(String(url));return {ok:true,
   json:async()=>({result:{latitude:52.6369,longitude:-1.1398,outcode:'LE1'}})};};
  assert.deepEqual(await lookupUkPostcode(' le1 '),{
   latitude:52.6369,longitude:-1.1398,outcode:'LE1'});
  assert.deepEqual(await lookupUkPostcode('LE1 5AA'),{
   latitude:52.6369,longitude:-1.1398,outcode:'LE1',postcode:'LE15AA'});
  assert(urls[0].includes('/outcodes/LE1'));
  assert(urls[1].includes('/postcodes/LE15AA'));
  await assert.rejects(lookupUkPostcode('invalid'),/postcode or district/);
  assert.equal(urls.length,2,'Bad postcodes must not hit the network');
  global.fetch=async(_url,opts)=>new Promise((resolve,reject)=>{
   opts.signal.addEventListener('abort',()=>{const e=new Error('aborted');e.name='AbortError';reject(e)});
  });
  await assert.rejects(lookupUkPostcode('LE1',5),/timed out/);
  global.fetch=async()=>{throw new TypeError('network failed')};
  await assert.rejects(lookupUkPostcode('LE1'),/connection/);
  global.fetch=async()=>({ok:true,json:async()=>({result:{latitude:NaN,longitude:11}})});
  await assert.rejects(lookupUkPostcode('LE1'),/coordinates/);
 }finally{global.fetch=previous}
 const cursorJs=ts.transpileModule(fs.readFileSync('lib/historyCursor.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const cursorMod={exports:{}};
 new Function('module','exports',cursorJs)(cursorMod,cursorMod.exports);
 const {historyBefore,compareHistory}=cursorMod.exports;
 const stamp='2026-11-27T12:00:00.123456+00:00';
 const id='c884200a-3e39-4c15-8843-d2ceaa312999';
 assert.equal(historyBefore({created_at:stamp,id}),`created_at.lt.${stamp},and(created_at.eq.${stamp},id.lt.${id})`);
 assert.equal(historyBefore({created_at:stamp,id:42}),`created_at.lt.${stamp},and(created_at.eq.${stamp},id.lt.42)`);
 assert.throws(()=>historyBefore({created_at:stamp,id:'42,or(id.gt.0)'}),/Invalid/);
 assert.throws(()=>historyBefore({created_at:'today',id:42}),/Invalid/);
 const rows=Array.from({length:120},(_,i)=>({id:i+1,created_at:stamp}));
 assert.equal(rows.sort(compareHistory)[0].id,1);
 assert.ok(compareHistory({created_at:'2026-11-27T12:00:00.123455+00:00',id:999},{created_at:stamp,id:1})<0);
 const pages=[];let before=Infinity;
 while(true){const page=rows.filter(r=>r.id<before).sort((a,b)=>compareHistory(b,a)).slice(0,50);if(!page.length)break;pages.push(...page);before=page.at(-1).id;}
 assert.equal(new Set(pages.map(r=>r.id)).size,120,'Same-timestamp records must not be skipped');
 const app=fs.readFileSync('App.tsx','utf8');
 const inbox=fs.readFileSync('UnifiedMessagesScreen.tsx','utf8');
 assert(app.includes("import {lookupUkPostcode} from './lib/postcodeLookup'"));
 assert(!app.includes("fetch('https://api.postcodes.io"));
 assert(!app.includes("fetch('https://api.postcodes.io/"));
 assert(inbox.includes('threadLoadVersion.current'));
 assert(inbox.includes('.or(cursor)')&&inbox.includes(".order('id',{ascending:false})"));
 assert(inbox.includes('inboxLoadVersion.current'));
 assert(inbox.includes('m.conversation_id===id'));
 assert(inbox.includes('selectedRef.current!==requestId'));
 assert(inbox.includes('prior.data.body!==body'));
 assert(inbox.includes('prior.data.conversation_id!==targetConversationId'));
 assert(inbox.includes("setDraft('');setPhoto(null);setDocument(null)"));
 console.log('Tradarr native messaging and postcode resilience checks passed');
}
test().catch(err=>{console.error(err);process.exitCode=1});
