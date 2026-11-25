const assert=require('node:assert/strict');
const fs=require('node:fs');
const rules=JSON.parse(fs.readFileSync('data/supplier-query-rules.json','utf8'));
const app=fs.readFileSync('TradeSuppliersMap.tsx','utf8');
const data=fs.readFileSync('data/TradeSupplierDirectory.ts','utf8');
const importer=fs.readFileSync('scripts/import-supplier-directory.py','utf8');
const regions=['derbyshire','leicestershire','lincolnshire','northamptonshire','nottinghamshire','rutland','herefordshire','shropshire','staffordshire','warwickshire','west-midlands','worcestershire'];
for(const region of regions)assert.ok(importer.includes("'"+region+"'"));
assert.ok(app.includes('convertResults(directoryElements, near, radiusMiles)'));
assert.ok(!app.includes('.slice(0, 180)'));
assert.ok(app.includes('seenIds')&&app.includes('byName')&&app.includes('deltaLat'));
assert.ok(rules.shopTypes.includes('trade')&&rules.shopTypes.includes('hardware')&&rules.shopTypes.includes('building_materials'));
assert.ok(app.includes('supplierRules.shopTypes')&&app.includes('supplierRules.brandPattern'));
const records=data.split('\n').filter(l=>l.startsWith('{"type":')).map(l=>JSON.parse(l.replace(/,$/,'')));
if(process.argv.includes('--require-data')){
 assert.ok(records.length>=500,'Missing Midlands data');
 const meta=JSON.parse(data.match(/export const directoryMetadata=(.*);/)[1]);
 assert.equal(meta.count,records.length);
 for(const region of regions)assert.ok(meta.counts[region]>=5,'Missing county '+region);
}
const ids=new Set();
for(const r of records){
 assert.ok(['node','way','relation'].includes(r.type));
 assert.ok(Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&r.lat>=49&&r.lat<=56&&r.lon>=-7&&r.lon<=3);
 assert.ok(r.tags.name||r.tags.brand);
 const id=r.type+'/'+r.id;assert.ok(!ids.has(id),'Duplicate OSM object '+id);ids.add(id);
}
console.log('Supplier directory source checks passed; '+records.length+' actual bundled records.');
