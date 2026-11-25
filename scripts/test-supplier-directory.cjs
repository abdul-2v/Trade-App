const assert=require('node:assert/strict');
const fs=require('node:fs');
const rules=JSON.parse(fs.readFileSync('data/supplier-query-rules.json','utf8'));
const app=fs.readFileSync('TradeSuppliersMap.tsx','utf8');
const data=fs.readFileSync('data/TradeSupplierDirectory.ts','utf8');
const importer=fs.readFileSync('scripts/import-supplier-directory.py','utf8');
const registry=JSON.parse(fs.readFileSync('data/supplier-regions.json','utf8'));
const regions=registry.Midlands.regions;
const allRegions=Object.values(registry).flatMap(batch=>batch.regions);
assert.equal(allRegions.length,47,'All 47 published England extract areas must be covered');
assert.equal(new Set(allRegions).size,47,'No repeated extract area');
for(const region of regions)assert.ok(importer.includes("'"+region+"'"));
assert.ok(app.includes('convertResults(directoryElements, near, radiusMiles)'));
assert.ok(!app.includes('.slice(0, 180)'));
assert.ok(app.includes('seenIds')&&app.includes('byName')&&app.includes('deltaLat'));
assert.ok(rules.shopTypes.includes('trade')&&rules.shopTypes.includes('hardware')&&rules.shopTypes.includes('building_materials'));
assert.ok(app.includes('supplierRules.shopTypes')&&app.includes('supplierRules.brandPattern'));
const records=data.split('\n').filter(l=>l.startsWith('{"type":')).map(l=>JSON.parse(l.replace(/ as DirectoryElement,?$/,'').replace(/,$/,'')));
if(process.argv.includes('--require-data')){
 assert.ok(records.length>=500,'Missing Midlands data');
 const meta=JSON.parse(data.match(/export const directoryMetadata=(.*);/)[1]);
 assert.equal(meta.count,records.length);
 for(const region of regions)assert.ok(meta.counts[region]>=1,'Missing county '+region);
}
const ids=new Set();
for(const r of records){
 assert.ok(['node','way','relation'].includes(r.type));
 assert.ok(Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&r.lat>=49&&r.lat<=56&&r.lon>=-7&&r.lon<=3);
 assert.ok(r.tags.name||r.tags.brand);
 const id=r.type+'/'+r.id;assert.ok(!ids.has(id),'Duplicate OSM object '+id);ids.add(id);
}
console.log('Supplier directory source checks passed; '+records.length+' actual bundled records.');

// Functional tests run in ordinary app CI, where TypeScript is installed.
// Import CI deliberately requires only Node built-ins to validate actual output.
if(process.argv.includes('--logic')){
 const ts=require('typescript');
 const prefix=app.slice(app.indexOf('type TradeName ='),app.indexOf('const UK_POSTCODE ='));
 const groups=app.slice(app.indexOf('const merchantGroups:'),app.indexOf('async function getFreshDeviceLocation'));
 const logic=app.slice(app.indexOf('function haversine('),app.indexOf('async function loadSuppliers('));
 const merge=app.slice(app.indexOf('function mergeMerchantSources('),app.indexOf('const merchantGroups:'));
 const source=prefix+groups+merge+logic+'\nreturn {classifyShop,convertResults,overpassQuery,mergeMerchantSources,supplierMatchesFilter,supplierFilterLabel};';
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
 const f=new Function('theme','supplierRules',js)({colors:{}},rules);
 assert.ok(f.classifyShop({shop:'hardware',name:'Independent Hardware'}).general);
 assert.ok(f.classifyShop({shop:'trade',trade:'plumbing',name:'Independent Plumbing'}).kinds.includes('Plumber'));
 assert.ok(f.classifyShop({shop:'trade',trade:'electrical',name:'Independent Electrics'}).kinds.includes('Electrician'));
 assert.ok(f.classifyShop({shop:'trade',trade:'roofing',name:'Independent Roofing'}).kinds.includes('Roofer'));
 assert.ok(f.classifyShop({shop:'ironmonger',name:'Independent Ironmonger'}).kinds.includes('Locksmith'));
 assert.equal(f.classifyShop({name:'Screwfix',highway:'bus_stop'}),null);
 assert.equal(f.classifyShop({name:'Toolstation',shop:'vacant'}),null);
 assert.equal(f.classifyShop({name:'Food Wholesaler',shop:'wholesale',wholesale:'food'}),null);
 const centre={latitude:52.6,longitude:-1.1};
 const pts=Array.from({length:250},(_,i)=>({type:'node',id:i,lat:52.6+i*.00001,lon:-1.1,tags:{name:'Fixture '+i,shop:'hardware'}}));
 pts.push({...pts[0],type:'way',id:999});
 pts.push({type:'node',id:1001,lat:55,lon:-1.1,tags:{name:'Outside radius',shop:'hardware'}});
 const nearby=f.convertResults(pts,centre,10);
 assert.equal(nearby.length,250,'No silent cap, duplicate or out-of-radius point');
 assert.equal(f.mergeMerchantSources(nearby,nearby).length,250,'Live and snapshot ID dedup');
 assert.ok(f.overpassQuery(centre,10).includes('["brand"~'));
 const general={general:true,kinds:['Builder']};
 const plumber={general:false,kinds:['Plumber','Heating']};
 const electrical={general:false,kinds:['Electrician']};
 const builder={general:false,kinds:['Builder','Roofer']};
 const stock=[general,plumber,electrical,builder];
 assert.deepEqual(stock.filter(x=>f.supplierMatchesFilter(x,'mine','Electrician')),[general,electrical]);
 assert.deepEqual(stock.filter(x=>f.supplierMatchesFilter(x,'Plumber','Electrician')),[general,plumber]);
 assert.deepEqual(stock.filter(x=>f.supplierMatchesFilter(x,'specialist','Plumber')),[plumber,electrical,builder]);
 assert.deepEqual(stock.filter(x=>f.supplierMatchesFilter(x,'general','Plumber')),[general]);
 assert.deepEqual(stock.filter(x=>f.supplierMatchesFilter(x,'all','Plumber')),stock);
 assert.equal(f.supplierFilterLabel('mine','Electrician'),'Electrician');
 assert.equal(f.supplierFilterLabel('Carpenter','Electrician'),'Carpenter');
 console.log('PASS: registered default, cross-trade browsing, specialists across all trades, general and all filters');
 console.log('PASS: supplier classification, closure and bus stop rejection, exact radius, 250 points, source dedup');
}
assert.ok(app.includes('mapVisible=useMemo')&&app.includes('viewportCount')&&app.includes('mapVisibleById.get(data.id)'),'Regional map pins must remain browsable and selectable separately from the nearby list');

const selectedBatch=process.argv.find(x=>x.startsWith('--batch='))?.split('=')[1];
for(const [name,batch] of Object.entries(registry)){
 if(name==='Midlands')continue;
 const content=fs.readFileSync(batch.file,'utf8');
 const points=content.split('\n').filter(l=>l.startsWith('{"type":')).map(l=>JSON.parse(l.replace(/ as DirectoryElement,?$/,'').replace(/,$/,'')));
 if(name===selectedBatch){
  assert.ok(points.length>=500,'No usable '+name+' snapshot');
  const meta=JSON.parse(content.match(/export const directoryMetadata=(.*);/)[1]);
  assert.equal(meta.count,points.length);
  assert.deepEqual(meta.regions,batch.regions);
  for(const region of batch.regions)assert.ok(meta.counts[region]>=1,'Missing '+region);
 }
 const seen=new Set();
 for(const row of points){
  const id=row.type+'/'+row.id;
  assert.ok(['node','way','relation'].includes(row.type)&&!seen.has(id));
  assert.ok(Number.isFinite(row.lat)&&Number.isFinite(row.lon)&&row.lat>=49&&row.lat<=56&&row.lon>=-7&&row.lon<=3);
  assert.ok(row.tags.name||row.tags.brand);
  seen.add(id);
 }
 console.log(name+': '+points.length+' bundled raw OSM records');
}
if(selectedBatch)assert.ok(registry[selectedBatch]&&selectedBatch!=='Midlands','Unknown expansion batch');
const aggregator=fs.readFileSync('data/TradeSupplierDirectoryEngland.ts','utf8');
assert.ok(aggregator.includes('for(const batch of [midlands,north,eastSouth,outer])')&&aggregator.includes('seen.has(id)'));
assert.ok(app.includes("from './data/TradeSupplierDirectoryEngland'")&&app.includes('convertResults(directoryElements,LEICESTER,400)'));

assert.ok(app.includes('ALL_TRADES.map(trade=>')&&app.includes("chooseTrade('specialist')"),'Dropdown must expose every supported trade and specialist');
assert.ok(app.includes("(['general','all'] as const).map")&&!app.includes("['specialist','Specialist']"),'Only General and All shops should remain standalone filters');
assert.ok(app.includes('[shops, filter, primaryTrade, referencePosition.latitude, referencePosition.longitude]')&&app.includes('[regional,shops,filter,primaryTrade]'),'Map and nearby list must update together');
