const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const src=fs.readFileSync('lib/featuredVisibility.ts','utf8');
const code=ts.transpileModule(src,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020
}}).outputText;
const obj={exports:{}};
new Function('module','exports',code)(obj,obj.exports);
const split=obj.exports.splitPromotedNearby;
const entries=[
 {id:'live-near',promoted:false,distance:0.1,coverageDistanceMiles:0.1},
 {id:'live-paid-far',promoted:true,distance:20,coverageDistanceMiles:20},
 {id:'live-paid-close',promoted:true,distance:1,coverageDistanceMiles:1},
 {id:'live-paid-mid',promoted:true,distance:3,coverageDistanceMiles:3},
 {id:'demo-promoted',promoted:true,distance:0,coverageDistanceMiles:0}
];
const {featured,organic}=split(entries,false);
assert.deepEqual(featured.map(x=>x.id),['live-paid-close','live-paid-mid'],
 'Only the two nearest eligible REAL paid listings may use sponsored positions');
assert.deepEqual(organic.map(x=>x.id),['live-near','live-paid-far','demo-promoted'],
 'Organic sort must remain unchanged and featured entries must not duplicate');
assert.deepEqual(split(entries,true).featured,[],
 'Fictional demo mode must never show sponsored placements');
assert.deepEqual(split(entries,true).organic,entries);
assert.deepEqual(split(entries,false,0).featured,[]);
assert.equal(new Set([...featured,...organic].map(x=>x.id)).size,entries.length);
const app=fs.readFileSync('App.tsx','utf8');
assert.ok(app.includes('Promoted nearby · paid placement'));
assert.ok(app.includes('Promoted · paid placement'));
assert.ok(app.includes('class="trade-ad-tag"'));
assert.ok(app.includes('promoted: profile.promoted === true'),
 'Public promoted status must originate from the server read model');
console.log('Verified boost presentation: 2 sponsored slots, no demo promotions, no duplication, organic ordering retained.');
