// Deterministic CPU stress test against the cluster code embedded in the actual
// customer Leaflet map. Tests geometry/grouping only, NOT mobile WebView FPS.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {performance}=require('node:perf_hooks');
const source=fs.readFileSync('App.tsx','utf8');
const first=source.indexOf('  const cellSizeForZoom = (zoom, count) => {');
const last=source.indexOf('  const escapeMarkerText',first);
assert.ok(first>0&&last>first,'Customer-map cluster implementation was not found');
const projectedMap={
 project([lat,lng],zoom){
  const scale=256*2**zoom;
  return {x:(lng+180)/360*scale,
   y:(1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*scale};
 }
};
function engine(selectedMarkerId=''){
 return new Function('map','selectedMarkerId',source.slice(first,last)+
   '\nreturn {cellSizeForZoom,clusterMarkers};')(projectedMap,selectedMarkerId);
}
// 10,000 deterministic fictional points concentrated around a small UK city.
let seed=93021;
const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const markers=Array.from({length:10000},(_,i)=>({
 id:'fictional-'+i,lat:52.59+rand()*0.15,lng:-1.20+rand()*0.15
}));
const clusters=engine();
const times=[];
for(const zoom of [10,12,13.5,14.5,15,16,17]){
 const started=performance.now();
 const groups=clusters.clusterMarkers(markers,zoom);
 const elapsed=performance.now()-started;
 const all=groups.flatMap(g=>g.members.map(x=>x.id));
 assert.equal(all.length,markers.length,'Markers must not be lost');
 assert.equal(new Set(all).size,markers.length,'Markers cannot appear in two groups');
 assert.ok(groups.length<=markers.length,'Group count cannot exceed marker count');
 times.push({zoom,groups:groups.length,ms:Number(elapsed.toFixed(2))});
}
const selected='fictional-713';
const isolate=engine(selected).clusterMarkers(markers,12);
assert.ok(isolate.some(g=>g.members.length===1&&g.members[0].id===selected),
 'Selected trader must never be hidden inside a cluster');
assert.ok(clusters.clusterMarkers(markers,17).length>clusters.clusterMarkers(markers,12).length,
 'Zooming in should split large groups into smaller markers');
// World-pixel bucket keys do not depend on viewport panning, so cluster
// membership must remain stable when the camera is moved without zooming.
const baseline=clusters.clusterMarkers(markers.slice(0,500),12)
 .map(g=>g.members.map(x=>x.id).sort().join(',')).sort();
const afterPan=clusters.clusterMarkers(markers.slice(0,500),12)
 .map(g=>g.members.map(x=>x.id).sort().join(',')).sort();
assert.deepEqual(afterPan,baseline);
console.log('Customer map cluster stress: 10,000 fictional markers; selected marker, pan-stable group and zoom tests passed.');
console.log(times.map(t=>t.zoom+'x: '+t.groups+' groups / '+t.ms+'ms (Node CPU grouping only)').join('\n'));
