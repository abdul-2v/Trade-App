import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { supabase } from './lib/supabase';
import { LEICESTER_SUPPLIER_SEEDS } from './TradeSuppliersLeicester';
import { theme } from './theme';
import { MotionPressable } from './Motion';
import { Crosshair, RotateCw, X, Navigation, Store, ChevronRight } from 'lucide-react-native';

type TradeName = 'Plumber' | 'Electrician' | 'Builder' | 'Heating' | 'Locksmith' | 'Carpenter' | 'Roofer';
type Coordinates = { latitude: number; longitude: number };
type Supplier = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  distance: number;
  kinds: TradeName[];
  general: boolean;
  postcodeApproximate?: boolean;
};
type Filter = 'mine' | 'all' | 'general' | 'specialist';

const INK = theme.colors.ink;
const LIGHT = theme.colors.white;
const ACCENT = theme.colors.coral;
const LEICESTER: Coordinates = { latitude: 52.6369, longitude: -1.1398 };
const ALL_TRADES: TradeName[] = ['Plumber', 'Electrician', 'Builder', 'Heating', 'Locksmith', 'Carpenter', 'Roofer'];
const PLUMBING: TradeName[] = ['Plumber', 'Heating'];
const BUILDING: TradeName[] = ['Builder', 'Roofer', 'Carpenter'];
const STORE_CACHE = new Map<string, { expires: number; stores: Supplier[] }>();

// Real, verified Leicester merchants are ready instantly, even if the public
// Overpass endpoint is slow or unavailable. Pins are postcode-centre approximations.
function localDirectorySuppliers(near: Coordinates, radiusMiles: number): Supplier[] {
  return LEICESTER_SUPPLIER_SEEDS
    .map(store => ({
      ...store,
      postcodeApproximate: true,
      distance: haversine(near, { latitude: store.latitude, longitude: store.longitude }),
    }))
    .filter(store => store.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance);
}

function mergeMerchantSources(directory: Supplier[], live: Supplier[]): Supplier[] {
  const combined = [...live];
  for (const shop of directory) {
    const duplicate = combined.some(other => {
      const a = other.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const b = shop.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (a === b || a.includes(b) || b.includes(a))
        && haversine(
          { latitude: other.latitude, longitude: other.longitude },
          { latitude: shop.latitude, longitude: shop.longitude }
        ) < 0.35;
    });
    if (!duplicate) combined.push(shop);
  }
  return combined.sort((a, b) => a.distance - b.distance);
}

const merchantGroups: Array<{ match: RegExp; trades: TradeName[]; general?: boolean }> = [
  { match: /screwfix|toolstation|b\s*&\s*q|wickes|homebase|home hardware/i, trades: ALL_TRADES, general: true },
  { match: /city plumbing|wolseley|plumbase|plumbing trade|plumbing supplies|plumb centre|graham plumbers|james hargreaves|heat merchant|heating supplies|pts plumbing/i, trades: PLUMBING },
  { match: /\bcef\b|city electrical factors|yesss|rexel|edmundson|denmans|electrical wholesalers|electrical supplies|electric center|electric centre|tlc electrical/i, trades: ['Electrician'] },
  { match: /travis perkins|jewson|selco|mkm building|huws gray|huws grey|buildbase|builders merchant|building supplies/i, trades: BUILDING },
  { match: /howdens|benchmarx|timber merchant|timber centre|timber yard|wood supplier|joinery supplies/i, trades: ['Carpenter', 'Builder'] },
  { match: /sig roofing|roofing supplies|roofing merchant|roofing centre|roofing depot/i, trades: ['Roofer', 'Builder'] },
  { match: /ironmong|lock supplies|lock centre|locksmith supplies|security hardware/i, trades: ['Locksmith', 'Carpenter'] },
];

async function getFreshDeviceLocation(): Promise<Location.LocationObject | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const current = await Promise.race<Location.LocationObject | null>([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), 9000);
      }),
    ]);
    if (current) return current;
  } catch {
    // The device may have no fresh GPS fix indoors.
  } finally {
    if (timer) clearTimeout(timer);
  }
  try {
    return await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 500 });
  } catch {
    return null;
  }
}

function haversine(a: Coordinates, b: Coordinates) {
  const radians = (n: number) => n * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function classifyShop(tags: Record<string, string>): { kinds: TradeName[]; general: boolean } | null {
  const name = [tags.name, tags.brand, tags.operator].filter(Boolean).join(' ');
  const specialty = (tags.trade || '').toLowerCase();
  for (const group of merchantGroups) {
    if (group.match.test(name)) return { kinds: group.trades, general: Boolean(group.general) };
  }

  const shop = (tags.shop || '').toLowerCase();
  if (['hardware', 'doityourself', 'power_tools'].includes(shop)) {
    return { kinds: ALL_TRADES, general: true };
  }
  if (shop === 'electrical' || /electric/.test(specialty)) {
    return { kinds: ['Electrician'], general: false };
  }
  if (/plumb|bathroom|heating|gas/.test(specialty)) return { kinds: PLUMBING, general: false };
  if (/roof/.test(specialty)) return { kinds: ['Roofer', 'Builder'], general: false };
  if (/timber|joinery|wood/.test(specialty)) return { kinds: ['Carpenter', 'Builder'], general: false };
  if (/lock|ironmong/.test(specialty)) return { kinds: ['Locksmith', 'Carpenter'], general: false };
  if (/building|construction/.test(specialty) || shop === 'building_materials') {
    return { kinds: BUILDING, general: false };
  }
  if (shop === 'tiles' || shop === 'bathroom_furnishing') {
    return { kinds: ['Plumber', 'Builder'], general: false };
  }
  if (shop === 'doors' || shop === 'windows' || shop === 'flooring') {
    return { kinds: ['Carpenter', 'Builder'], general: false };
  }
  if (shop === 'paint') return { kinds: ['Builder', 'Carpenter'], general: false };
  // Unknown wholesale and unrelated trade shops are deliberately excluded.
  return null;
}

type OsmElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function convertResults(elements: OsmElement[], near: Coordinates, radiusMiles: number): Supplier[] {
  const deduped: Supplier[] = [];
  for (const element of elements) {
    const tags = element.tags || {};
    const name = (tags.name || tags.brand || '').trim();
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!name || latitude === undefined || longitude === undefined) continue;

    const classification = classifyShop(tags);
    if (!classification) continue;
    const distance = haversine(near, { latitude, longitude });
    if (distance > radiusMiles + 0.2) continue;

    const address = [
      [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
      tags['addr:city'],
      tags['addr:postcode'],
    ].filter(Boolean).join(', ');

    const exists = deduped.some(other =>
      other.name.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, '')
      && haversine({ latitude: other.latitude, longitude: other.longitude }, { latitude, longitude }) < 0.09
    );
    if (exists) continue;
    deduped.push({
      id: element.type + '/' + element.id,
      name,
      latitude,
      longitude,
      distance,
      kinds: classification.kinds,
      general: classification.general,
      address: address || 'Address not listed',
      phone: tags['contact:phone'] || tags.phone,
      website: tags['contact:website'] || tags.website,
      openingHours: tags.opening_hours,
    });
  }
  return deduped.sort((a, b) => a.distance - b.distance).slice(0, 180);
}

function overpassQuery(centre: Coordinates, radiusMiles: number) {
  const radius = Math.round(radiusMiles * 1609.344);
  const at = '(around:' + radius + ',' + centre.latitude.toFixed(5) + ',' + centre.longitude.toFixed(5) + ')';
  return '[out:json][timeout:22];('
    + 'nwr' + at + '["shop"~"^(trade|doityourself|hardware|building_materials|electrical|wholesale|paint|tiles|flooring|doors|windows|power_tools|bathroom_furnishing)$"];'
    + 'nwr' + at + '["name"~"Screwfix|Toolstation|B&Q|Wickes|City Plumbing|Wolseley|Plumbase|CEF|YESSS|Rexel|Edmundson|Travis Perkins|Jewson|Selco|MKM|Howdens|Benchmarx|SIG Roofing",i];'
    + ');out center tags;';
}

async function loadSuppliers(centre: Coordinates, radiusMiles: number): Promise<Supplier[]> {
  const key = centre.latitude.toFixed(2) + ':' + centre.longitude.toFixed(2) + ':' + radiusMiles;
  const cached = STORE_CACHE.get(key);
  if (cached && cached.expires > Date.now()) return cached.stores;

  // Public Overpass is best-effort, not a production guaranteed live service.
  // Use one maintained endpoint, with an absolute deadline even on devices where
  // AbortController does not reliably stop a React Native fetch.
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const query = overpassQuery(centre, radiusMiles);
  const url = 'https://overpass.private.coffee/api/interpreter';

  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Merchant lookup timed out.'));
      }, 13500);
    });
    const request = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Merchant lookup unavailable (' + response.status + ').');
      const data = await response.json() as { elements?: OsmElement[]; remark?: string };
      if (data.remark) throw new Error('Merchant lookup returned an incomplete result.');
      if (!Array.isArray(data.elements)) throw new Error('Invalid merchant map data.');
      return convertResults(data.elements, centre, radiusMiles);
    });
    const result = await Promise.race([request, deadline]);
    STORE_CACHE.set(key, { stores: result, expires: Date.now() + 15 * 60 * 1000 });
    return result;
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}

// The map stays mounted during filtering, preserving the user's zoom and position.
// Expo SDK 58 / RN 0.88 typing interop: preserve the same native WebView at runtime.
const MapWebView = WebView as React.ComponentType<any>;

function createMapHtml(centre: Coordinates) {
  return `
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" />
<style>
/* Mid-tone slate-teal map: readable streets/labels without the black night-map effect.
   Filters apply to basemap imagery only; interactive markers retain full contrast. */
html,body,#map{margin:0;width:100%;height:100%;overflow:hidden;background:#738E90}
.maplibregl-canvas{filter:brightness(.76) contrast(.98) saturate(.85) sepia(.15) hue-rotate(125deg)}
.leaflet-tile-pane img{filter:brightness(.76) contrast(.98) saturate(.85) sepia(.15) hue-rotate(125deg)}
.leaflet-control-attribution{font-size:8px!important;background:rgba(13,37,43,.87)!important;color:#A9C1C1!important;padding:2px 5px!important;border-top-left-radius:5px!important}
.leaflet-control-attribution a{color:#B5CFCC!important;text-decoration:none!important}
.you-label{border-radius:13px;background:rgba(15,42,48,.94);border:1px solid #5E8588;padding:4px 8px;color:#fff;font:700 10px sans-serif;white-space:nowrap;text-align:center;box-shadow:0 3px 10px #0b272844}
.pin{position:relative;width:32px;height:32px;border-radius:10px;background:#F1F7F4;border:2px solid white;box-shadow:0 3px 10px #0B262A70;color:#245758;display:flex;align-items:center;justify-content:center}
.pin.general{background:#E0704C}.pin:hover{transform:scale(1.12)}
.cluster{width:38px;height:38px;border-radius:19px;background:#FFFDF7;border:2px solid #3B7377;box-shadow:0 3px 12px #0C202D66;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#0C1F24}
.you-pin{width:24px;height:24px;border-radius:50%;background:#E0704C;border:5px solid #fff;box-shadow:0 0 0 6px #E0704C33,0 2px 14px #1B467A77;box-sizing:border-box}
.work-pin{border:2px solid #68788C;background:#F9FAFC;border-radius:9px;padding:4px 7px;color:#35465A;font-size:10px;font-weight:900;white-space:nowrap;box-shadow:0 2px 8px #233A4A33}

/* Distinctive pin drop, location sonar and moving route -- CSS-only inside the map WebView. */
@keyframes markerDrop{0%{transform:translateY(-24px) scale(.65);opacity:0}65%{transform:translateY(3px) scale(1.07);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes sonar{0%{transform:scale(.7);opacity:.85}100%{transform:scale(3.6);opacity:0}}
@keyframes routeMarch{to{stroke-dashoffset:-24}}
.pin,.cluster{animation:markerDrop .37s cubic-bezier(.18,.87,.26,1.08) both}
.pin{transition:transform .24s ease,box-shadow .26s ease}
.pin.is-selected{transform:scale(1.18);box-shadow:0 0 0 5px #F2A98466,0 7px 18px #132E3577;border-color:#F2A984}
.pin.is-selected:after{content:"";position:absolute;inset:-12px;border:2px solid #E0704C;border-radius:16px;pointer-events:none;animation:chosenPulse 1.65s ease-out infinite}
@keyframes chosenPulse{0%{transform:scale(.72);opacity:.85}100%{transform:scale(1.65);opacity:0}}
@keyframes clusterBloom{0%{box-shadow:0 0 0 0 #E0704C99;transform:scale(.88)}70%{box-shadow:0 0 0 17px #E0704C00;transform:scale(1.14)}100%{box-shadow:0 0 0 20px #E0704C00;transform:scale(1)}}
.cluster.is-opening{animation:clusterBloom .58s cubic-bezier(.16,.8,.3,1) both}
.focus-halo{position:relative;width:54px;height:54px;border:2px solid #E0704C;border-radius:50%;box-shadow:0 0 0 6px #E0704C28;animation:focusArrive 1.1s cubic-bezier(.16,.8,.3,1) both;pointer-events:none}
.focus-halo:after{content:"";position:absolute;inset:8px;border:1.5px dashed #E0704C;border-radius:50%;animation:focusRotate 3.2s linear infinite;pointer-events:none}
.travel-beacon{width:13px;height:13px;border-radius:50%;background:#E0704C;border:3px solid white;box-sizing:border-box;box-shadow:0 0 0 5px #E0704C44,0 2px 10px #12384499;pointer-events:none}
@keyframes focusArrive{0%{transform:scale(.45);opacity:0}60%{transform:scale(1.13);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes focusRotate{to{transform:rotate(360deg)}}
#shop-sweep{position:absolute;inset:0;pointer-events:none;z-index:500;opacity:0;
  background:linear-gradient(108deg,transparent 28%,rgba(145,213,203,.02) 39%,rgba(120,213,198,.22) 50%,rgba(255,255,255,.04) 61%,transparent 75%);transform:translateX(-100%)}
@keyframes shopSweep{0%{transform:translateX(-100%);opacity:0}20%{opacity:1}80%{opacity:.9}100%{transform:translateX(110%);opacity:0}}
#shop-sweep.play{animation:shopSweep .8s cubic-bezier(.14,.8,.22,1) both}
.pin:active,.cluster:active{transform:scale(.88)}
.you-pin{position:relative;isolation:isolate}
.you-pin:before,.you-pin:after{content:"";position:absolute;inset:-5px;border:2px solid #E0704C;border-radius:50%;pointer-events:none;animation:sonar 2.6s ease-out infinite}
.you-pin:after{animation-delay:1.3s}
.leaflet-interactive.route-active{animation:routeMarch 1s linear infinite}
@media(prefers-reduced-motion:reduce){.pin,.cluster,.you-pin:before,.you-pin:after,.route-active,#shop-sweep,.pin.is-selected:after,.focus-halo,.focus-halo:after{animation:none!important}.pin{transition:none!important}}
</style></head><body><div id="map"></div><div id="shop-sweep"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js"></script>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:true,zoomSnap:0.25}).setView([${centre.latitude},${centre.longitude}],12.6);
if(L.maplibreGL){
  try { L.maplibreGL({style:'https://tiles.openfreemap.org/styles/liberty'}).addTo(map); }
  catch(e) { L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map); }
} else {
  // Low-volume fallback for development when the vector plugin does not load.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map);
}
map.attributionControl.setPrefix('');
map.attributionControl.addAttribution('© OpenStreetMap contributors · OpenFreeMap');
var layer=L.layerGroup().addTo(map);
var activeShops=new Map();
var shops=[],selectedShopId=null;
function playShopSweep(){
 var el=document.getElementById('shop-sweep');
 if(!el||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 el.classList.remove('play');void el.offsetWidth;el.classList.add('play');
}
var userPoint=null, userMarker=null, userLabelMarker=null, workMarker=null, accuracyArea=null, shopLink=null;
var focusedHalo=null,travelDot=null,travelFrame=0;
var reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
function stopFocusAnimation(){
 if(travelFrame)cancelAnimationFrame(travelFrame);
 travelFrame=0;
 removeFeature(travelDot);travelDot=null;
 removeFeature(focusedHalo);focusedHalo=null;
}
function removeFeature(feature){if(feature && map.hasLayer(feature))map.removeLayer(feature);}
window.updateLocations=function(points){
  removeFeature(userMarker);removeFeature(userLabelMarker);removeFeature(workMarker);removeFeature(accuracyArea);
  userMarker=null;userLabelMarker=null;workMarker=null;accuracyArea=null;
  var current=points&&points.current, work=points&&points.workArea;
  // Work-area pin is an appropriate origin when live GPS is not shared.
  userPoint=current||work||null;
  if(work && (!current || Math.abs(current.lat-work.lat)+Math.abs(current.lng-work.lng)>.001)){
    var wicon=L.divIcon({className:'',html:'<span class="work-pin">Work area</span>',iconSize:[75,24],iconAnchor:[37,12]});
    workMarker=L.marker([work.lat,work.lng],{icon:wicon,interactive:false,zIndexOffset:400}).addTo(map);
  }
  if(current){
    if(current.accuracy && current.accuracy>25 && current.accuracy<1000){
      accuracyArea=L.circle([current.lat,current.lng],{
        radius:current.accuracy,weight:1,color:'#E0704C',fillColor:'#E0704C',fillOpacity:.09,interactive:false
      }).addTo(map);
    }
    var icon=L.divIcon({className:'',html:'<div class="you-pin"></div>',iconSize:[24,24],iconAnchor:[12,12]});
    userMarker=L.marker([current.lat,current.lng],{icon:icon,interactive:false,zIndexOffset:1100}).addTo(map);
    var label=L.divIcon({className:'',html:'<div class="you-label">You are here</div>',iconSize:[94,24],iconAnchor:[47,-17]});
    userLabelMarker=L.marker([current.lat,current.lng],{icon:label,interactive:false,zIndexOffset:1100}).addTo(map);
  }
};
window.centerOnMe=function(){
  if(userPoint)map.flyTo([userPoint.lat,userPoint.lng],Math.max(14,map.getZoom()),{duration:.67,easeLinearity:.22});
};
window.moveMapArea=function(lat,lng){
  if(Number.isFinite(lat)&&Number.isFinite(lng))map.flyTo([lat,lng],Math.max(12.6,map.getZoom()),{duration:.72,easeLinearity:.22});
};
window.clearShopLine=function(){
  stopFocusAnimation();
  removeFeature(shopLink);shopLink=null;selectedShopId=null;
  document.querySelectorAll('.pin.is-selected').forEach(function(el){el.classList.remove('is-selected');});
};
function draw(){
 var zoom=map.getZoom(),buckets={},desired=new Set();
 var bounds=map.getBounds().pad(.18);
 shops.forEach(function(shop){
  if(!bounds.contains([shop.lat,shop.lng]))return;
  var p=map.latLngToContainerPoint([shop.lat,shop.lng]);
  var spacing=zoom>=14?0:zoom>=12.7?44:57;
  var key=spacing?Math.floor(p.x/spacing)+':'+Math.floor(p.y/spacing):shop.id;
  if(!buckets[key])buckets[key]=[];
  buckets[key].push(shop);
 });
 Object.keys(buckets).forEach(function(key){
  var group=buckets[key];
  if(group.length===1){
    var item=group[0],identity='s:'+item.id;
    desired.add(identity);
    if(!activeShops.has(identity)){
      var shopSvg='<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M3 10 5 4h14l2 6v2a2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0v-2Z"/><path d="M5 14v6h14v-6M9 20v-5h6v5"/></svg>';
      var html='<div class="pin'+(item.general?' general':'')+(selectedShopId===item.id?' is-selected':'')+'" style="animation-delay:'+Math.min(210,activeShops.size*28)+'ms" data-id="'+
        String(item.id).replace(/[^a-zA-Z0-9_/:.-]/g,'')+'">'+shopSvg+'</div>';
      var icon=L.divIcon({className:'',html:html,iconSize:[32,32],iconAnchor:[16,16]});
      var marker=L.marker([item.lat,item.lng],{icon:icon}).on('click',function(){
        selectedShopId=item.id;
        document.querySelectorAll('.pin[data-id]').forEach(function(pin){
          pin.classList.toggle('is-selected',pin.getAttribute('data-id')===selectedShopId);
        });
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'supplier',id:item.id}));
      }).addTo(layer);
      activeShops.set(identity,marker);
    }
  }else{
    var ids=group.map(function(item){return item.id}).sort();
    var identity='c:'+ids.join('|');
    desired.add(identity);
    if(!activeShops.has(identity)){
      var lat=group.reduce(function(t,item){return t+item.lat},0)/group.length;
      var lon=group.reduce(function(t,item){return t+item.lng},0)/group.length;
      var icon=L.divIcon({className:'',html:'<div class="cluster">'+group.length+'</div>',
        iconSize:[38,38],iconAnchor:[19,19]});
      var marker=L.marker([lat,lon],{icon:icon}).on('click',function(){
        var el=marker.getElement();
        if(el){var node=el.querySelector('.cluster');if(node)node.classList.add('is-opening');}
        playShopSweep();
        map.flyTo([lat,lon],Math.min(16,map.getZoom()+1.5),
          {duration:reducedMotion.matches?0:.72,easeLinearity:.22});
      }).addTo(layer);
      activeShops.set(identity,marker);
    }
  }
 });
 activeShops.forEach(function(marker,key){
  if(!desired.has(key)){layer.removeLayer(marker);activeShops.delete(key);}
 });
}
window.showSuppliers=function(list){
  shops=Array.isArray(list)?list:[];draw();playShopSweep();
};
window.focusSupplier=function(lat,lng){
  window.clearShopLine();
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
  var picked=shops.find(function(s){return Math.abs(s.lat-lat)+Math.abs(s.lng-lng)<.000002;});
  if(picked)selectedShopId=picked.id;
  document.querySelectorAll('.pin[data-id]').forEach(function(el){
    el.classList.toggle('is-selected',el.getAttribute('data-id')===selectedShopId);
  });
  focusedHalo=L.marker([lat,lng],{
    icon:L.divIcon({className:'',html:'<div class="focus-halo"></div>',iconSize:[54,54],iconAnchor:[27,27]}),
    interactive:false,zIndexOffset:180
  }).addTo(map);
  playShopSweep();
  if(userPoint){
    // Visual straight-line comparison only: this is NOT a road route or ETA.
    shopLink=L.polyline([[userPoint.lat,userPoint.lng],[lat,lng]],{
      color:'#E0704C',weight:3.5,dashArray:'7,10',opacity:.96,
      interactive:false,className:'route-active'
    }).addTo(map);
    var bounds=L.latLngBounds([[userPoint.lat,userPoint.lng],[lat,lng]]);
    map.flyToBounds(bounds.pad(.33),{padding:[48,48],maxZoom:14.8,
      duration:reducedMotion.matches?0:.95,easeLinearity:.2});
    if(!reducedMotion.matches){
      var animationStart=performance.now(),origin={lat:userPoint.lat,lng:userPoint.lng};
      travelDot=L.marker([origin.lat,origin.lng],{
        icon:L.divIcon({className:'',html:'<div class="travel-beacon"></div>',
          iconSize:[13,13],iconAnchor:[6,6]}),
        interactive:false,zIndexOffset:750
      }).addTo(map);
      // One short movement, never continuous/fake live tracking.
      function travel(now){
        if(!travelDot)return;
        var progress=Math.min(1,(now-animationStart)/1650);
        var eased=progress<.5?2*progress*progress:1-Math.pow(-2*progress+2,2)/2;
        travelDot.setLatLng([origin.lat+(lat-origin.lat)*eased,origin.lng+(lng-origin.lng)*eased]);
        if(progress<1)travelFrame=requestAnimationFrame(travel);
        else{removeFeature(travelDot);travelDot=null;travelFrame=0;}
      }
      travelFrame=requestAnimationFrame(travel);
    }
  }else{
    map.flyTo([lat,lng],Math.max(14,map.getZoom()),
      {duration:reducedMotion.matches?0:.85,easeLinearity:.2});
  }
};
map.on('moveend zoomend resize',draw);
</script></body></html>`;
}

export default function TradeSuppliersMap() {
  const mapRef = useRef<any>(null);
  const [centre, setCentre] = useState<Coordinates>(LEICESTER);
  const [positionReady, setPositionReady] = useState(false);
  const [positionName, setPositionName] = useState('Finding your position…');
  const [gpsPosition, setGpsPosition] = useState<Coordinates | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsState, setGpsState] = useState<'checking' | 'ready' | 'disabled' | 'unavailable'>('checking');
  const [savedWorkArea, setSavedWorkArea] = useState<Coordinates | null>(null);
  const [primaryTrade, setPrimaryTrade] = useState<TradeName | null>(null);
  const [filter, setFilter] = useState<Filter>('mine');
  const [radius, setRadius] = useState(10);
  const [shops, setShops] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [sourceNote, setSourceNote] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    let watch: Location.LocationSubscription | null = null;
    let queryOrigin = LEICESTER;

    const onPosition = (position: Location.LocationObject, changeMapArea: boolean) => {
      if (!active) return;
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setGpsPosition(next);
      setGpsAccuracy(position.coords.accuracy ?? null);
      setGpsState('ready');
      if (changeMapArea || haversine(queryOrigin, next) > 2.5) {
        queryOrigin = next;
        setCentre(next);
        setPositionName('Near your current location');
      }
    };

    async function locate() {
      let area: Coordinates = LEICESTER;
      let label = 'Leicester area · enable location for accurate distances';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [{ data: profile }, { data: availability }] = await Promise.all([
            supabase.from('tradesperson_profiles').select('primary_trade').eq('user_id', user.id).maybeSingle(),
            supabase.from('trade_availability')
              .select('location_mode, work_area_latitude, work_area_longitude')
              .eq('user_id', user.id).maybeSingle(),
          ]);
          if (profile?.primary_trade && ALL_TRADES.includes(profile.primary_trade as TradeName) && active) {
            setPrimaryTrade(profile.primary_trade as TradeName);
          }
          if (typeof availability?.work_area_latitude === 'number' &&
              typeof availability?.work_area_longitude === 'number') {
            area = { latitude: availability.work_area_latitude, longitude: availability.work_area_longitude };
            label = 'Saved work area · GPS not yet available';
            if (active) setSavedWorkArea(area);
          }
        }
      } catch {
        // The map can still start with the clearly labelled Leicester fallback.
      }

      if (!active) return;
      queryOrigin = area;
      setCentre(area);
      setPositionName(label);
      setPositionReady(true);

      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (!permission.granted) {
          setGpsState('disabled');
          return;
        }

        const fix = await getFreshDeviceLocation();
        if (!active) return;
        if (fix) onPosition(fix, true);
        else setGpsState('unavailable');

        const subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 12000 },
          pos => onPosition(pos, false)
        );
        if (active) watch = subscription;
        else subscription.remove();
      } catch {
        if (active) setGpsState('unavailable');
      }
    }

    locate();
    return () => {
      active = false;
      watch?.remove();
    };
  }, []);

  useEffect(() => {
    if (!positionReady) return;
    let active = true;
    const nearbyDirectory = localDirectorySuppliers(centre, radius);

    // Never block Leicester tradespeople behind a remote loading spinner.
    setShops(nearbyDirectory);
    setSelected(null);
    setLoading(nearbyDirectory.length === 0);
    setProblem(null);
    setSourceNote(nearbyDirectory.length
      ? 'Leicester directory locations shown · checking latest map records…'
      : 'Checking map records…');

    loadSuppliers(centre, radius)
      .then(found => {
        if (!active) return;
        const combined = mergeMerchantSources(nearbyDirectory, found);
        setShops(combined);
        setLoading(false);
        setSourceNote(nearbyDirectory.length
          ? 'Leicester directory + OpenStreetMap locations'
          : 'Locations from OpenStreetMap');
        if (!combined.length) {
          setProblem('No merchants found within this radius. Try expanding the area or open Maps to search directly.');
        }
      })
      .catch(() => {
        if (!active) return;
        setShops(nearbyDirectory);
        setLoading(false);
        setSourceNote(nearbyDirectory.length
          ? 'Leicester directory locations · map search temporarily unavailable'
          : 'Live merchant lookup is temporarily unavailable');
        if (!nearbyDirectory.length) {
          setProblem('The map service is unavailable. Use Find shops in Maps or try again.');
        }
      });

    return () => { active = false; };
  }, [positionReady, centre.latitude, centre.longitude, radius, refreshIndex]);

  const referencePosition = gpsPosition || centre;
  const usingGps = gpsState === 'ready' && !!gpsPosition;
  const visible = useMemo(() => shops
    .filter(shop => {
      if (filter === 'all') return true;
      if (filter === 'general') return shop.general;
      if (filter === 'specialist') return !shop.general && (!primaryTrade || shop.kinds.includes(primaryTrade));
      return !primaryTrade || shop.kinds.includes(primaryTrade);
    })
    .map(shop => ({
      ...shop,
      distance: haversine(referencePosition, { latitude: shop.latitude, longitude: shop.longitude }),
    }))
    .sort((a,b) => a.distance - b.distance),
  [shops, filter, primaryTrade, referencePosition.latitude, referencePosition.longitude]);

  useEffect(() => {
    if (selected && !visible.some(s => s.id === selected.id)) setSelected(null);
  }, [visible, selected]);

  const sendToMap = () => {
    const values = visible.map(s => ({ id: s.id, name: s.name, lat: s.latitude, lng: s.longitude, general: s.general }));
    const encoded = JSON.stringify(values).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
    mapRef.current?.injectJavaScript('if(window.showSuppliers){window.showSuppliers(' + encoded + ')};true;');
  };

  useEffect(sendToMap, [visible]);

  const sendPositionToMap = () => {
    const payload = {
      current: gpsPosition
        ? { lat: gpsPosition.latitude, lng: gpsPosition.longitude, accuracy: gpsAccuracy || 0 }
        : null,
      workArea: savedWorkArea
        ? { lat: savedWorkArea.latitude, lng: savedWorkArea.longitude }
        : null,
    };
    mapRef.current?.injectJavaScript(
      'if(window.updateLocations){window.updateLocations(' + JSON.stringify(payload) + ')};true;'
    );
  };
  useEffect(sendPositionToMap, [
    gpsPosition?.latitude, gpsPosition?.longitude, gpsAccuracy,
    savedWorkArea?.latitude, savedWorkArea?.longitude,
  ]);

  // Keep the merchant canvas and camera mounted when GPS finds a better position.
  const mapHtml=useMemo(()=>createMapHtml(centre),[]);
  const mapSource=useRef<{html:string}>({html:mapHtml});
  useEffect(()=>{
    if(!positionReady)return;
    mapRef.current?.injectJavaScript(
      'if(window.moveMapArea){window.moveMapArea('+centre.latitude+','+centre.longitude+')}true;'
    );
  },[positionReady,centre.latitude,centre.longitude]);

  const centreOnMyLocation = async () => {
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && !permission.canAskAgain) {
        await Linking.openSettings();
        return;
      }
      if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setGpsState('disabled');
        return;
      }
      const fix = await getFreshDeviceLocation();
      if (!fix) {
        setGpsState('unavailable');
        return;
      }
      const current = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
      setGpsPosition(current);
      setGpsAccuracy(fix.coords.accuracy ?? null);
      setGpsState('ready');
      setCentre(current);
      setPositionName('Near your current location');
      mapRef.current?.injectJavaScript(
        'if(window.centerOnMe){window.centerOnMe()};true;'
      );
    } catch {
      setGpsState('unavailable');
    }
  };

  useEffect(() => {
    const javascript = selected
      ? 'if(window.focusSupplier){window.focusSupplier(' + selected.latitude + ',' + selected.longitude + ')};true;'
      : 'if(window.clearShopLine){window.clearShopLine()};true;';
    mapRef.current?.injectJavaScript(javascript);
  }, [selected?.id]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string };
      if (data.type === 'supplier' && data.id) {
        const item = visible.find(s => s.id === data.id);
        if (item) setSelected(item);
      }
    } catch { /* ignore unexpected messages */ }
  };

  const openDirections = (shop: Supplier) => {
    // For directory records, address lookup is more accurate than their postcode-centre pin.
    const destination = shop.postcodeApproximate
      ? shop.address
      : shop.latitude + ',' + shop.longitude;
    return Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination));
  };

  const openShopsInMaps = () =>
    Linking.openURL('https://www.google.com/maps/search/?api=1&query='
      + encodeURIComponent((primaryTrade || 'trade') + ' merchants near ' + centre.latitude + ',' + centre.longitude));

  return (
    <View style={S.root}>
      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={S.eyebrow}>TRADE SUPPLY FINDER</Text>
            <Text style={S.title}>Merchants nearby</Text>
            <Text style={S.subtitle} numberOfLines={2}>{positionName} · {primaryTrade || 'All trades'}</Text>
          </View>
          <MotionPressable style={S.radiusButton} onPress={() => setRadius(r => r === 5 ? 10 : r === 10 ? 20 : 5)}>
            <Text style={S.radiusNumber}>{radius} mi</Text>
            <View style={S.radiusCaptionRow}><Text style={S.radiusCaption}>radius</Text><RotateCw size={12} color={'#C7D6D5'} strokeWidth={2} /></View>
          </MotionPressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filters}>
          {([
            ['mine', primaryTrade ? 'My trade · ' + primaryTrade : 'For my trade'],
            ['general', 'General supplies'],
            ['specialist', 'Specialist merchants'],
            ['all', 'All shops'],
          ] as [Filter, string][]).map(([value, label]) => (
            <MotionPressable key={value} style={[S.chip, filter === value && S.chipActive]} onPress={() => setFilter(value)}>
              <Text style={[S.chipText, filter === value && S.chipTextActive]}>{label}</Text>
            </MotionPressable>
          ))}
        </ScrollView>
      </View>
      <View style={S.mapArea}>
        <MapWebView
          ref={mapRef}
          source={mapSource.current}
          style={S.webView}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
          onLoadEnd={() => {
            sendToMap();sendPositionToMap();
            mapRef.current?.injectJavaScript(
              'if(window.moveMapArea){window.moveMapArea('+centre.latitude+','+centre.longitude+')}true;'
            );
          }}
          scrollEnabled={false}
        />
        <View pointerEvents="none" style={S.locationLegend}>
          <View style={usingGps ? S.youDot : S.workDot} />
          <Text style={S.legendText}>{savedWorkArea ? 'Work area' : usingGps ? 'My location' : 'Leicester area'}</Text>
        </View>
        <MotionPressable
          style={S.recenterButton}
          onPress={centreOnMyLocation}
          accessibilityRole="button"
          accessibilityLabel="Show my current location on the map"
        >
          <Crosshair size={23} color={INK} strokeWidth={2} />
        </MotionPressable>
        <View pointerEvents="none" style={S.counter}>
          <Text style={S.counterText}>{loading ? 'Finding shops…' : visible.length + ' shops on map'}</Text>
        </View>
        {loading ? (
          <View style={S.loading}>
            <ActivityIndicator color={ACCENT} />
            <Text style={S.loadingText}>Finding nearby trade merchants…</Text>
          </View>
        ) : problem ? (
          <View style={S.notice}>
            <Text style={S.noticeText}>{problem}</Text>
            <View style={S.noticeActions}>
              <MotionPressable style={S.noticeButton} onPress={() => { STORE_CACHE.clear(); setRefreshIndex(x => x + 1); }}>
                <Text style={S.noticeButtonText}>Retry</Text>
              </MotionPressable>
              <MotionPressable style={S.noticeButton} onPress={openShopsInMaps}>
                <Text style={S.noticeButtonText}>Find shops in Maps</Text>
              </MotionPressable>
            </View>
          </View>
        ) : !visible.length ? (
          <View style={S.notice}>
            <Text style={S.noticeText}>No matching merchants found in this area. Try All shops or increase the radius.</Text>
          </View>
        ) : null}
        <View style={S.bottomPanel}>
          {selected ? (
            <>
              <View style={S.storeHeader}>
                <View style={S.storeGlyph}><Store size={22} color={theme.colors.teal} strokeWidth={2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.storeTitle} numberOfLines={2}>{selected.name}</Text>
                  <Text style={S.storeMeta}>
                    {haversine(referencePosition, { latitude: selected.latitude, longitude: selected.longitude }).toFixed(1)} mi {usingGps ? 'from you' : savedWorkArea ? 'from work area' : 'from Leicester'} · {selected.general ? 'General supplies' : 'Trade specialist'}
                  </Text>
                </View>
                <MotionPressable onPress={() => setSelected(null)} style={S.close} accessibilityRole="button" accessibilityLabel="Close selected supplier"><X size={21} strokeWidth={2} color={theme.colors.ink} /></MotionPressable>
              </View>
              <Text style={S.address} numberOfLines={2}>{selected.address}</Text>
                 <Text style={S.pinDisclaimer}>Straight-line animation only · Directions opens the road route.</Text>
              {selected.postcodeApproximate ? <Text style={S.pinDisclaimer}>Approximate map pin (postcode centre)</Text> : null}
              <View style={S.actions}>
                <MotionPressable style={S.primaryButton} onPress={() => openDirections(selected)}>
                  <Navigation size={19} strokeWidth={2} color={theme.colors.white} /><Text style={S.primaryButtonText}>Get directions</Text>
                </MotionPressable>
                {selected.phone ? (
                  <MotionPressable style={S.secondaryButton} onPress={() => Linking.openURL('tel:' + selected.phone!.replace(/[^+\d]/g, ''))}>
                    <Text style={S.secondaryText}>Call shop</Text>
                  </MotionPressable>
                ) : null}
              </View>
            </>
          ) : (
            <>
              <View style={S.panelHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={S.panelTitle}>Closest {primaryTrade ? primaryTrade.toLowerCase() + ' suppliers' : 'trade suppliers'}</Text>
                  <Text style={S.panelHint}>{usingGps ? 'Nearest to your location' : 'Nearest to ' + (savedWorkArea ? 'your work area' : 'Leicester')} · straight-line miles</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.nearbyRow} style={S.nearbyScroll}>
                {visible.slice(0, 8).map((shop, index) => (
                  <MotionPressable
                    key={shop.id}
                    style={S.nearbyShop}
                    onPress={() => {
                      setSelected(shop);
                      mapRef.current?.injectJavaScript('window.focusSupplier(' + shop.latitude + ',' + shop.longitude + ');true;');
                    }}
                  >
                    <Text style={S.nearbyRank}>#{index + 1} CLOSEST</Text>
                    <Text style={S.nearbyTitle} numberOfLines={2}>{shop.name}</Text>
                    <View style={S.nearbyLink}><Text style={S.nearbyDistance}>{shop.distance.toFixed(1)} mi {usingGps ? 'from you' : 'away'}</Text><ChevronRight size={16} strokeWidth={2} color={theme.colors.teal} /></View>
                  </MotionPressable>
                ))}
              </ScrollView>
            </>
          )}
          <View pointerEvents="none" style={S.sheetHandle} />
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.darkTeal, paddingBottom: 0 },
  header: { paddingTop: 14, paddingHorizontal: 22, paddingBottom: 8, backgroundColor: theme.colors.darkTeal },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.45, color: '#F4A184', marginBottom: 5 },
  title: { fontSize: 26, fontWeight: '800', color: theme.colors.white, letterSpacing: -0.8 },
  subtitle: { marginTop: 5, color: '#BDCFD0', fontSize: 12, lineHeight: 17 },
  radiusButton: { backgroundColor: '#324A50', borderWidth: 1, borderColor: '#546A6F', borderRadius: 17, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 7, marginLeft: 4, minWidth: 69, minHeight: 52, justifyContent: 'center' },
  radiusNumber: { color: theme.colors.white, fontSize: 18, fontWeight: '800' },
  radiusCaptionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  radiusCaption: { color: '#CED9D9', fontSize: 12, fontWeight: '500' },
  filters: { paddingTop: 12, paddingRight: 18, paddingBottom: 3 },
  chip: { backgroundColor: '#344B50', borderWidth: 1, borderColor: '#586D71', borderRadius: 24, minHeight: 41, paddingHorizontal: 15, paddingVertical: 10, marginRight: 8 },
  chipActive: { backgroundColor: theme.colors.white, borderColor: theme.colors.white },
  chipText: { color: '#ECF4F2', fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: theme.colors.ink },
  mapArea: { flex: 1, backgroundColor: '#738E90', overflow: 'hidden' },
  webView: { flex: 1, backgroundColor: '#738E90' },
  counter: { position: 'absolute', top: 13, left: 14, borderRadius: 18, minHeight: 39, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#354F53E8', borderWidth: 1, borderColor: '#6F8687' },
  locationLegend: { position: 'absolute', top: 13, left: 142, borderRadius: 18, minHeight: 39, backgroundColor: '#354F53E8', borderWidth: 1, borderColor: '#6F8687', flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, maxWidth: 120 },
  youDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: theme.colors.coral, borderColor: theme.colors.white, borderWidth: 2, marginRight: 6 },
  workDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#9BB8B6', borderColor: theme.colors.white, borderWidth: 2, marginRight: 6 },
  legendText: { fontSize: 11, fontWeight: '700', color: theme.colors.white, flexShrink: 1 },
  recenterButton: { position: 'absolute', top: 11, right: 14, width: 44, height: 44, backgroundColor: theme.colors.white, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...theme.shadow },
  recenterText: { color: theme.colors.ink, fontSize: 13, fontWeight: '800' },
  counterText: { fontSize: 11, color: theme.colors.white, fontWeight: '700' },
  loading: { position: 'absolute', left: 16, right: 16, top: 74, padding: 15, borderRadius: 18, backgroundColor: theme.colors.white, flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { color: theme.colors.ink, fontSize: 13, fontWeight: '700' },
  notice: { position: 'absolute', left: 16, right: 16, top: 76, padding: 15, borderRadius: 18, backgroundColor: theme.colors.white, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.line },
  noticeText: { color: theme.colors.ink, fontSize: 13, textAlign: 'center' },
  noticeButton: { backgroundColor: theme.colors.darkTeal, borderRadius: 22, paddingHorizontal: 17, paddingVertical: 12, marginTop: 11, minHeight: 44 },
  noticeActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  noticeButtonText: { color: LIGHT, fontSize: 13, fontWeight: '800' },
  bottomPanel: { position: 'absolute', bottom: 12, left: 12, right: 12, borderRadius: 26, paddingHorizontal: 14, paddingTop: 19, paddingBottom: 11, backgroundColor: theme.colors.white, ...theme.shadow },
  storeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  storeGlyph: { width: 44, height: 44, borderRadius: 15, backgroundColor: theme.colors.tealTint, alignItems: 'center', justifyContent: 'center' },
  storeTitle: { color: theme.colors.ink, fontSize: 17, fontWeight: '800', lineHeight: 21, letterSpacing: -0.4 },
  storeMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 3 },
  close: { width: 44, height: 44, backgroundColor: theme.colors.soft, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  address: { color: theme.colors.muted, fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', marginTop: 10, gap: 8 },
  primaryButton: { flex: 1, minHeight: 48, backgroundColor: theme.colors.darkTeal, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryButtonText: { color: theme.colors.white, fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 48, backgroundColor: theme.colors.soft, paddingHorizontal: 14, borderRadius: 24, justifyContent: 'center' },
  secondaryText: { color: theme.colors.ink, fontSize: 13, fontWeight: '800' },
  panelHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.35 },
  panelHint: { color: theme.colors.muted, marginTop: 3, fontSize: 12, lineHeight: 17 },
  sheetHandle: { position: 'absolute', top: 6, width: 32, height: 4, borderRadius: 2, backgroundColor: '#D5DEDB', alignSelf: 'center' },
  nearbyScroll: { flexGrow: 0 },
  nearbyRow: { paddingTop: 10, paddingBottom: 1 },
  nearbyShop: { width: 155, minHeight: 86, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: theme.colors.proBackground, marginRight: 9, justifyContent: 'space-between' },
  nearbyRank: { color: theme.colors.coralText, fontWeight: '800', letterSpacing: 0.35, fontSize: 11, marginBottom: 5 },
  nearbyTitle: { color: theme.colors.ink, fontSize: 13, lineHeight: 16, fontWeight: '800' },
  nearbyLink: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  nearbyDistance: { color: theme.colors.muted, fontSize: 12 },
  attribution: { marginTop: 3, fontSize: 12, color: theme.colors.muted },
  sourceNote: { marginTop: 10, fontSize: 12, color: theme.colors.teal, fontWeight: '700' },
  pinDisclaimer: { marginTop: 5, fontSize: 12, color: theme.colors.coralText },
});
