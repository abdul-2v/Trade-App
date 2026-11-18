const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
function load(path){
 const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
 }).outputText;
 const mod={exports:{}};
 new Function('module','exports','require',js)(mod,mod.exports,require);
 return mod.exports;
}
const {milesBetween,distanceToRouteMiles,rankPublishedRoutes}=load('lib/routeMatching.ts');
const {ukSlotToISO,advanceISOByMinutes,formatUKDateTime}=load('lib/scheduling.ts');
const eq=(a,b)=>assert.equal(a,b);
const near=(a,b,max)=>assert.ok(Math.abs(a-b)<max,`distance ${a} != expected ${b}`);
const a={latitude:52.63,longitude:-1.14},b={latitude:52.63,longitude:-1.04};
near(distanceToRouteMiles(a,b,{latitude:52.63,longitude:-1.09}),0,.001);
assert.ok(distanceToRouteMiles(a,b,{latitude:52.68,longitude:-1.09})>3);
near(milesBetween(a,a),0,.0001);
assert.ok(milesBetween(a,b)>3);
const plan={
 id:'p1',tradesperson_id:'trade-1',trade:'Plumber',mode:'on_my_way',
 start_latitude:52.63,start_longitude:-1.14,
 end_latitude:52.63,end_longitude:-1.04,
 starts_at:'2026-11-19T10:00:00Z',ends_at:'2026-11-19T12:00:00Z',
 max_deviation_miles:2,status:'open',max_extra_visits:1
};
const at={latitude:52.633,longitude:-1.09},now='2026-11-18T15:00:00Z',
 deadline='2026-11-20T10:00:00Z';
eq(rankPublishedRoutes([plan],at,'Plumber','on_my_way',deadline,now).length,1);
eq(rankPublishedRoutes([plan],at,'Electrician','on_my_way',deadline,now).length,0);
eq(rankPublishedRoutes([plan],at,'Plumber','street_run',deadline,now).length,0);
eq(rankPublishedRoutes([plan],{latitude:52.70,longitude:-1.09},'Plumber','on_my_way',deadline,now).length,0);
eq(rankPublishedRoutes([plan],at,'Plumber','on_my_way','2026-11-19T09:00:00Z',now).length,0);
eq(rankPublishedRoutes([{...plan,status:'paused'}],at,'Plumber','on_my_way',deadline,now).length,0);
eq(rankPublishedRoutes([{...plan,starts_at:'2026-11-17T10:00:00Z'}],at,'Plumber','on_my_way',deadline,now).length,0);
const group={...plan,mode:'street_run',end_latitude:52.63,end_longitude:-1.09};
eq(rankPublishedRoutes([group],at,'Plumber','street_run',deadline,now).length,1);
eq(ukSlotToISO('2026-11-18','10:00'),'2026-11-18T10:00:00.000Z');
eq(ukSlotToISO('2026-07-01','10:00'),'2026-07-01T09:00:00.000Z');
eq(ukSlotToISO('2026-03-29','01:30'),null);
eq(ukSlotToISO('2026-11-31','10:00'),null);
eq(advanceISOByMinutes('2026-11-18T10:00:00.000Z',90),'2026-11-18T11:30:00.000Z');
assert.ok(formatUKDateTime('2026-11-18T10:00:00.000Z').includes('10:00'));
// Private photo attachment format and upload-path tests: MIME must match actual bytes.
const {decodeChatPhotoBase64,detectChatPhotoMime,chatPhotoPath}=load('lib/chatPhoto.ts');
const jpg=Buffer.from([255,216,255,224,0,16,74,70,73,70]).toString('base64');
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13]).toString('base64');
const webp=Buffer.from('RIFF....WEBPVP8 ','ascii').toString('base64');
eq(detectChatPhotoMime(jpg),'image/jpeg');
eq(detectChatPhotoMime(png),'image/png');
eq(detectChatPhotoMime(webp),'image/webp');
assert.throws(()=>detectChatPhotoMime(Buffer.from('not a real photo').toString('base64')),/not supported/);
assert.deepEqual(Array.from(decodeChatPhotoBase64(jpg)),Array.from(Buffer.from(jpg,'base64')));
const photoConversation='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const photoSender='11111111-2222-4333-8444-555555555555';
const photoToken='f0d0c0b0-a0a0-4000-8000-f9f9f9f9f9f9';
const basePath=photoConversation+'/'+photoSender+'/'+photoToken;
eq(chatPhotoPath(photoConversation,photoSender,photoToken),basePath+'.jpg');
eq(chatPhotoPath(photoConversation,photoSender,photoToken,'image/png'),basePath+'.png');
eq(chatPhotoPath(photoConversation,photoSender,photoToken,'image/webp'),basePath+'.webp');
assert.throws(()=>chatPhotoPath('invalid',photoSender,photoToken),/Invalid photo/);
assert.throws(()=>decodeChatPhotoBase64('bad!'),/not readable/);

console.log('Tradarr scheduling, route matching, UK DST and private-chat-photo logic checks passed.');
