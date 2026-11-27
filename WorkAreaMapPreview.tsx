import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { LEICESTER_SUPPLIER_SEEDS } from './TradeSuppliersLeicester';

type WorkAreaMapPreviewProps = {
  latitude: number;
  longitude: number;
  showPin: boolean;
  trade?: string;
  demandZones?: {lat:number;lng:number;band:string}[];
  demandRadius?: number;
};

/** Lightweight, view-only map. The full merchant finder lives in the Map tab. */
export default function WorkAreaMapPreview({ latitude, longitude, showPin, trade = '', demandZones, demandRadius=20 }: WorkAreaMapPreviewProps) {
  const lat = Number.isFinite(latitude) && Math.abs(latitude) <= 90 ? Number(latitude.toFixed(4)) : 52.6369;
  const lon = Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? Number(longitude.toFixed(4)) : -1.1398;
  const nearby = useMemo(() => {
    if(demandZones)return [];
    const kind = trade.toLowerCase().trim();
    return LEICESTER_SUPPLIER_SEEDS
      .filter(shop => !kind || shop.kinds.some(item => item.toLowerCase() === kind))
      .filter(shop => Math.abs(shop.latitude - lat) < 0.19 && Math.abs(shop.longitude - lon) < 0.28)
      .sort((a, b) => {
        const da = (a.latitude - lat) ** 2 + (a.longitude - lon) ** 2;
        const db = (b.latitude - lat) ** 2 + (b.longitude - lon) ** 2;
        return da - db;
      })
      .slice(0, 9)
      .map(shop => [shop.longitude, shop.latitude]);
  }, [lat, lon, trade, demandZones]);

  const html = useMemo(() => `
<!doctype html>
<html lang="en"><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" />
<style>
html,body,#map{width:100%;height:100%;margin:0;overflow:hidden;background:#738E90;}
.maplibregl-canvas{filter:brightness(.94) contrast(.98) saturate(.80) sepia(.06) hue-rotate(125deg)}
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;}
#fallback{position:absolute;inset:0;z-index:2;display:flex;justify-content:center;align-items:center;color:#B9D2CF;
background:repeating-linear-gradient(35deg,#102B31 0px,#102B31 29px,#174047 31px,#174047 50px);font-size:12px;}
.shop-pin{width:14px;height:14px;border-radius:50%;border:3px solid #DDEAF1;background:#E0704C;box-shadow:0 2px 5px #27546A55;box-sizing:border-box;}
.pin{width:23px;height:23px;border:5px solid white;border-radius:50%;background:#E0704C;
box-shadow:0 0 0 6px rgba(206,112,82,.20),0 4px 14px #203E5555;box-sizing:border-box;}
/* Visible animated location sonar plus a staggered reveal of nearby merchants. */
@keyframes homeSonar{0%{transform:scale(.55);opacity:.75}100%{transform:scale(4);opacity:0}}
@keyframes merchantPop{0%{transform:translateY(12px) scale(.72);opacity:0}75%{transform:translateY(-1px) scale(1.035);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes merchantGlow{0%{box-shadow:0 0 0 0 #E0704C44}100%{box-shadow:0 0 0 10px #E0704C00}}
@keyframes previewSheen{0%{transform:translateX(-110%);opacity:0}15%{opacity:.7}82%{opacity:.5}100%{transform:translateX(110%);opacity:0}}
.preview-sheen{position:absolute;inset:0;pointer-events:none;z-index:3;opacity:0;
  background:linear-gradient(108deg,transparent 22%,rgba(184,238,228,.02) 40%,rgba(189,246,232,.22) 50%,transparent 69%);
  animation:previewSheen 1.25s ease-out .65s both}
.pin{position:relative;isolation:isolate;overflow:visible}
.pin:before,.pin:after{content:"";position:absolute;left:-5px;top:-5px;width:23px;height:23px;box-sizing:border-box;border:2.5px solid #F07850;border-radius:50%;pointer-events:none;animation:homeSonar 2.8s ease-out infinite}
.pin:after{animation-delay:1.4s}
.shop-pin{animation:merchantPop .46s cubic-bezier(.2,.8,.26,1) both,merchantGlow .8s ease-out 1 both;animation-delay:var(--delay,0ms),calc(var(--delay,0ms) + 460ms)}
@media(prefers-reduced-motion:reduce){.pin:before,.pin:after,.shop-pin,.preview-sheen{animation:none!important}}
.maplibregl-control-container{display:none}
#attribution{position:absolute;z-index:4;right:5px;bottom:3px;background:#ffffffc4;color:#637683;font-size:8px;padding:2px 4px;border-radius:4px}
</style></head><body>
<div id="fallback">${demandZones?"Demand map loading":"Work area preview"}</div><div id="map"></div><div class="preview-sheen" aria-hidden="true"></div>
<div id="attribution">© OpenStreetMap contributors · OpenFreeMap</div>
<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<script>
try {
  var map = new maplibregl.Map({
    container:'map',style:'https://tiles.openfreemap.org/styles/liberty',
    center:[${lon},${lat}],zoom:${demandZones?Math.max(8,Math.min(12,12-Math.log2(Math.max(1,demandRadius)/5))):11.25},interactive:false,attributionControl:false,fadeDuration:200
  });
  map.on('load',function(){
    document.getElementById('fallback').style.display='none';
    if(!${Boolean(demandZones)} && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      map.easeTo({center:[${lon},${lat}],zoom:11.9,duration:870,
        easing:function(t){return 1-Math.pow(1-t,3)}});
    }else if(!${Boolean(demandZones)}){map.jumpTo({zoom:11.9});}
    var zones = ${JSON.stringify((demandZones||[]).filter(z=>Number.isFinite(z.lat)&&Number.isFinite(z.lng)&&['5–9','10–19','20+'].includes(z.band)))};
    if(zones.length){map.addSource('pulse-zones',{type:'geojson',data:{type:'FeatureCollection',features:zones.map(z=>({type:'Feature',geometry:{type:'Point',coordinates:[z.lng,z.lat]},properties:{band:z.band}}))}});map.addLayer({id:'pulse-zones',type:'circle',source:'pulse-zones',paint:{'circle-radius':['interpolate',['linear'],['zoom'],8,13,12,47],'circle-color':'#E0704C','circle-opacity':0.28,'circle-stroke-width':1,'circle-stroke-color':'#C4502B'}});zones.forEach(z=>{var label=document.createElement('div');label.style.cssText='background:#0F2A30;color:white;border-radius:12px;padding:4px 8px;font-weight:700;font-size:12px';label.textContent=z.band;new maplibregl.Marker({element:label}).setLngLat([z.lng,z.lat]).addTo(map)});}
    var shops = ${JSON.stringify(nearby)};
    shops.forEach(function(coords,index){
      var pin=document.createElement('div');pin.className='shop-pin';pin.style.setProperty('--delay',(index*95)+'ms');
      new maplibregl.Marker({element:pin,anchor:'center'}).setLngLat(coords).addTo(map);
    });
    if(${showPin ? 'true' : 'false'}){
      var dot=document.createElement('div');dot.className='pin';
      new maplibregl.Marker({element:dot,anchor:'center'}).setLngLat([${lon},${lat}]).addTo(map);
    }
  });
}catch(error){ document.getElementById('fallback').textContent='Map temporarily unavailable'; }
</script></body></html>`, [lat, lon, showPin, nearby,demandZones,demandRadius]);

  return (
    <View style={styles.frame}>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#0F2A30' },
  webview: { flex: 1, backgroundColor: '#E8EFF1' },
});
