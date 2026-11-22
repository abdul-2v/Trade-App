const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync('lib/scheduling.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
 target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',js)(mod,mod.exports,require);
const {nextUKDays,ukSlotToISO,advanceISOByMinutes,formatUKDateTime}=mod.exports;
let tests=0;
function test(label,fn){fn();tests++;console.log('PASS',label)}
test('civil UK days do not skip the spring clock change',()=>{
 assert.deepEqual(nextUKDays(3,new Date('2027-03-27T23:30:00Z')),
 ['2027-03-27','2027-03-28','2027-03-29']);
});
test('UK autumn day list stays ordered across the repeated hour',()=>{
 assert.deepEqual(nextUKDays(3,new Date('2027-10-30T23:30:00Z')),
 ['2027-10-31','2027-11-01','2027-11-02']);
});
test('spring-forward nonexistent 01:30 is rejected',()=>{
 assert.equal(ukSlotToISO('2027-03-28','01:30'),null);
 assert.equal(ukSlotToISO('2027-03-28','02:30'),'2027-03-28T01:30:00.000Z');
});
test('ambiguous autumn hour picks consistent first occurrence',()=>{
 assert.equal(ukSlotToISO('2027-10-31','01:30'),'2027-10-31T00:30:00.000Z');
 assert.match(formatUKDateTime('2027-10-31T00:30:00.000Z'),/01:30/);
});
test('invalid dates and durations cannot be confirmed',()=>{
 assert.equal(ukSlotToISO('2027-02-29','08:00'),null);
 assert.equal(advanceISOByMinutes('2027-11-05T09:00:00Z',14),null);
 assert.equal(advanceISOByMinutes('2027-11-05T09:00:00Z',721),null);
 assert.equal(advanceISOByMinutes('2027-11-05T09:00:00Z',60),'2027-11-05T10:00:00.000Z');
});
const route=fs.readFileSync('TradeRoutePlannerScreen.tsx','utf8');
const reschedule=fs.readFileSync('BookingReschedulePanel.tsx','utf8');
test('accepted route stops have mutual booking controls',()=>{
 assert(route.includes('<BookingReschedulePanel'));
 assert(route.includes('currentStart={stop.appointmentId?stop.requestedStart:null}'));
 assert(reschedule.includes('change.proposer_id===userId'));
 assert(reschedule.includes("decide('accepted')"));
});
test('no unauthorised GPS or false road-route promises in planner',()=>{
 assert(route.includes("setRoadPreviews(prev=>"));
 assert(route.includes("roadVersion.current"));
 assert(route.includes('abort.abort()'));
 assert(route.includes('tradarr-road-route'));
 assert(route.includes('No guaranteed arrival or discount'));
});
const addressCode=fs.readFileSync('lib/visitAddress.ts','utf8');
const addressJS=ts.transpileModule(addressCode,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const addressModule={exports:{}};
new Function('module','exports','require',addressJS)(addressModule,addressModule.exports,require);
const {hasFullVisitAddress,visitAddressDirectionsUrl}=addressModule.exports;
test('never navigate to postcode centroid or district',()=>{
 for(const address of ['LE1','LE1 5AA','Leicester LE1 5AA',
  'Postcode approximation, Leicester LE1 5AA','Confirm property address']){
  assert.equal(hasFullVisitAddress(address),false,address);
  assert.equal(visitAddressDirectionsUrl(address),null,address);
 }
 assert.equal(hasFullVisitAddress('10 Example Street, Leicester LE1 5AA'),true);
 assert(visitAddressDirectionsUrl('10 Example Street, Leicester LE1 5AA').includes(
  '10%20Example%20Street'));
});
test('native itinerary uses only private confirmed addresses',()=>{
 assert(route.includes('visitAddressDirectionsUrl(stop.address)'));
 assert(route.includes('address:job.appointment_id?confirmedAddresses.get('));
 assert(route.includes('.eq(\'job_id\',stop.jobId)'));
 assert(route.includes('scheduled.length!==assigned.length'));
 assert(route.includes("const linkedIds=[...new Set("));
 assert(route.includes('hasFullVisitAddress(anchor.address)'));
 assert(route.includes('confirmedAddresses.set(appointment.id'));
 assert(reschedule.includes("AppState.addEventListener('change'"));
 assert(reschedule.includes('if(routeMode&&!routeWindow)'));
 assert(!route.includes("const points=selected.map(x=>x.latitude+','+x.longitude)"));
 assert(route.includes('Postcode-area road estimate'));
});
console.log('Native scheduling checks passed:',tests);
