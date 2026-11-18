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
console.log('Tradarr scheduling, route geometry, expiry, privacy-mode and UK DST logic checks passed.');
