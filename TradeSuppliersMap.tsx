import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { supabase } from './lib/supabase';

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
};
type Filter = 'mine' | 'all' | 'general' | 'specialist';

const INK = '#111C29';
const LIGHT = '#F9F6EF';
const ACCENT = '#E9784F';
const LEICESTER: Coordinates = { latitude: 52.6369, longitude: -1.1398 };
const ALL_TRADES: TradeName[] = ['Plumber', 'Electrician', 'Builder', 'Heating', 'Locksmith', 'Carpenter', 'Roofer'];
const PLUMBING: TradeName[] = ['Plumber', 'Heating'];
const BUILDING: TradeName[] = ['Builder', 'Roofer', 'Carpenter'];
const STORE_CACHE = new Map<string, { expires: number; stores: Supplier[] }>();

const merchantGroups: Array<{ match: RegExp; trades: TradeName[]; general?: boolean }> = [
  { match: /screwfix|toolstation|b\s*&\s*q|wickes|homebase|home hardware/i, trades: ALL_TRADES, general: true },
  { match: /city plumbing|wolseley|plumbase|plumbing trade|plumbing supplies|plumb centre|graham plumbers|james hargreaves|heat merchant|heating supplies|pts plumbing/i, trades: PLUMBING },
  { match: /\bcef\b|city electrical factors|yesss|rexel|edmundson|denmans|electrical wholesalers|electrical supplies|electric center|electric centre|tlc electrical/i, trades: ['Electrician'] },
  { match: /travis perkins|jewson|selco|mkm building|huws gray|huws grey|buildbase|builders merchant|building supplies/i, trades: BUILDING },
  { match: /howdens|benchmarx|timber merchant|timber centre|timber yard|wood supplier|joinery supplies/i, trades: ['Carpenter', 'Builder'] },
  { match: /sig roofing|roofing supplies|roofing merchant|roofing centre|roofing depot/i, trades: ['Roofer', 'Builder'] },
  { match: /ironmong|lock supplies|lock centre|locksmith supplies|security hardware/i, trades: ['Locksmith', 'Carpenter'] },
];

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

  const query = overpassQuery(centre, radiusMiles);
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let lastError: Error = new Error('Could not reach the map data provider.');
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 23000);
    try {
      const response = await fetch(endpoint + '?data=' + encodeURIComponent(query), { signal: controller.signal });
      if (!response.ok) throw new Error('Map data provider is busy (' + response.status + ').');
      const data = await response.json() as { elements?: OsmElement[] };
      if (!Array.isArray(data.elements)) throw new Error('No valid store data was returned.');
      const stores = convertResults(data.elements, centre, radiusMiles);
      STORE_CACHE.set(key, { stores, expires: Date.now() + 15 * 60 * 1000 });
      return stores;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Merchant lookup failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

// The map stays mounted during filtering, preserving the user's zoom and position.
function createMapHtml(centre: Coordinates) {
  return `
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" />
<style>
html,body,#map{margin:0;width:100%;height:100%;overflow:hidden;background:#E7EBEF}
.leaflet-control-attribution{font-size:7px!important;background:rgba(255,255,255,.8)!important}
.pin{width:34px;height:34px;border-radius:11px;background:#243F55;border:2px solid white;box-shadow:0 3px 12px #14263955;color:white;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900}
.pin.general{background:#D3714E}.pin:hover{transform:scale(1.12)}
.cluster{width:42px;height:42px;border-radius:14px;background:#FFFDF7;border:2px solid #294C66;box-shadow:0 2px 10px #14263944;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#19344C}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js"></script>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:true,zoomSnap:0.25}).setView([${centre.latitude},${centre.longitude}],12.3);
if(L.maplibreGL){L.maplibreGL({style:'https://tiles.openfreemap.org/styles/liberty'}).addTo(map);}
map.attributionControl.setPrefix('');
map.attributionControl.addAttribution('© OpenStreetMap contributors · OpenFreeMap');
var layer=L.layerGroup().addTo(map);
var shops=[];
function draw(){
 layer.clearLayers();
 var zoom=map.getZoom(),buckets={};
 shops.forEach(function(s){
  if(!map.getBounds().pad(.2).contains([s.lat,s.lng]))return;
  var p=map.latLngToContainerPoint([s.lat,s.lng]);
  var spacing=zoom>=14?0:zoom>=12.7?44:57;
  var key=spacing?Math.floor(p.x/spacing)+':'+Math.floor(p.y/spacing):s.id;
  if(!buckets[key])buckets[key]=[];
  buckets[key].push(s);
 });
 Object.keys(buckets).forEach(function(key){
  var group=buckets[key];
  if(group.length===1){
   var s=group[0];
   var html='<div class="pin'+(s.general?' general':'')+'">▣</div>';
   var icon=L.divIcon({className:'',html:html,iconSize:[34,34],iconAnchor:[17,17]});
   L.marker([s.lat,s.lng],{icon:icon}).on('click',function(){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'supplier',id:s.id}));
   }).addTo(layer);
  }else{
   var lat=group.reduce((t,s)=>t+s.lat,0)/group.length;
   var lon=group.reduce((t,s)=>t+s.lng,0)/group.length;
   var icon=L.divIcon({className:'',html:'<div class="cluster">'+group.length+'</div>',iconSize:[42,42],iconAnchor:[21,21]});
   L.marker([lat,lon],{icon:icon}).on('click',function(){
    map.flyTo([lat,lon],Math.min(16,map.getZoom()+1.5),{duration:.28});
   }).addTo(layer);
  }
 });
}
window.showSuppliers=function(list){shops=Array.isArray(list)?list:[];draw()};
window.focusSupplier=function(lat,lng){map.flyTo([lat,lng],Math.max(14,map.getZoom()),{duration:.3})};
map.on('moveend zoomend resize',draw);
</script></body></html>`;
}

export default function TradeSuppliersMap() {
  const mapRef = useRef<WebView>(null);
  const [centre, setCentre] = useState<Coordinates>(LEICESTER);
  const [positionReady, setPositionReady] = useState(false);
  const [positionName, setPositionName] = useState('Locating your work area…');
  const [primaryTrade, setPrimaryTrade] = useState<TradeName | null>(null);
  const [filter, setFilter] = useState<Filter>('mine');
  const [radius, setRadius] = useState(10);
  const [shops, setShops] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    async function locate() {
      let coordinate: Coordinates | null = null;
      let label = 'Near Leicester · choose a work area in Profile';
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
          if (availability?.location_mode === 'work_area' &&
              typeof availability.work_area_latitude === 'number' &&
              typeof availability.work_area_longitude === 'number') {
            coordinate = { latitude: availability.work_area_latitude, longitude: availability.work_area_longitude };
            label = 'Your saved work area';
          }
        }
        if (!coordinate) {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (permission.status === 'granted') {
            const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            coordinate = { latitude: current.coords.latitude, longitude: current.coords.longitude };
            label = 'Near your current location';
          }
        }
      } catch {
        // If location is unavailable, Leicester is explicitly labelled as a fallback.
      }
      if (active) {
        setCentre(coordinate || LEICESTER);
        setPositionName(label);
        setPositionReady(true);
      }
    }
    locate();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!positionReady) return;
    let active = true;
    setLoading(true);
    setProblem(null);
    loadSuppliers(centre, radius)
      .then(found => { if (active) { setShops(found); setLoading(false); } })
      .catch(() => {
        if (active) {
          setShops([]);
          setLoading(false);
          setProblem('Merchant locations could not be loaded. Tap Retry to try again.');
        }
      });
    return () => { active = false; };
  }, [positionReady, centre.latitude, centre.longitude, radius, refreshIndex]);

  const visible = useMemo(() => shops.filter(shop => {
    if (filter === 'all') return true;
    if (filter === 'general') return shop.general;
    if (filter === 'specialist') return !shop.general && (!primaryTrade || shop.kinds.includes(primaryTrade));
    return !primaryTrade || shop.kinds.includes(primaryTrade);
  }), [shops, filter, primaryTrade]);

  useEffect(() => {
    if (selected && !visible.some(s => s.id === selected.id)) setSelected(null);
  }, [visible, selected]);

  const sendToMap = () => {
    const values = visible.map(s => ({ id: s.id, name: s.name, lat: s.latitude, lng: s.longitude, general: s.general }));
    const encoded = JSON.stringify(values).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
    mapRef.current?.injectJavaScript('window.showSuppliers(' + encoded + ');true;');
  };

  useEffect(sendToMap, [visible]);
  const mapHtml = useMemo(() => createMapHtml(centre), [centre.latitude, centre.longitude]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string };
      if (data.type === 'supplier' && data.id) {
        const item = visible.find(s => s.id === data.id);
        if (item) setSelected(item);
      }
    } catch { /* ignore unexpected messages */ }
  };

  const openDirections = (shop: Supplier) =>
    Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=' + shop.latitude + ',' + shop.longitude);

  return (
    <View style={S.root}>
      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={S.eyebrow}>TRADE SUPPLY FINDER</Text>
            <Text style={S.title}>Merchants nearby</Text>
            <Text style={S.subtitle} numberOfLines={2}>{positionName} · {primaryTrade || 'All trades'}</Text>
          </View>
          <Pressable style={S.radiusButton} onPress={() => setRadius(r => r === 5 ? 10 : r === 10 ? 20 : 5)}>
            <Text style={S.radiusNumber}>{radius} mi</Text>
            <Text style={S.radiusCaption}>radius ↻</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filters}>
          {([
            ['mine', primaryTrade ? 'For ' + primaryTrade.toLowerCase() + 's' : 'For my trade'],
            ['general', 'General supplies'],
            ['specialist', 'Specialist merchants'],
            ['all', 'All shops'],
          ] as [Filter, string][]).map(([value, label]) => (
            <Pressable key={value} style={[S.chip, filter === value && S.chipActive]} onPress={() => setFilter(value)}>
              <Text style={[S.chipText, filter === value && S.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={S.mapArea}>
        <WebView
          ref={mapRef}
          source={{ html: mapHtml }}
          style={S.webView}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
          onLoadEnd={sendToMap}
          scrollEnabled={false}
        />
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
            <Pressable style={S.noticeButton} onPress={() => { STORE_CACHE.clear(); setRefreshIndex(x => x + 1); }}>
              <Text style={S.noticeButtonText}>Retry</Text>
            </Pressable>
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
                <View style={S.storeGlyph}><Text style={S.storeGlyphText}>▣</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.storeTitle} numberOfLines={1}>{selected.name}</Text>
                  <Text style={S.storeMeta}>{selected.distance.toFixed(1)} mi away · {selected.general ? 'General supplies' : 'Trade specialist'}</Text>
                </View>
                <Pressable onPress={() => setSelected(null)} style={S.close}><Text style={S.closeText}>×</Text></Pressable>
              </View>
              <Text style={S.address} numberOfLines={2}>{selected.address}</Text>
              <View style={S.actions}>
                <Pressable style={S.primaryButton} onPress={() => openDirections(selected)}>
                  <Text style={S.primaryButtonText}>Get directions ↗</Text>
                </Pressable>
                {selected.phone ? (
                  <Pressable style={S.secondaryButton} onPress={() => Linking.openURL('tel:' + selected.phone!.replace(/[^+\d]/g, ''))}>
                    <Text style={S.secondaryText}>Call shop</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : (
            <>
              <Text style={S.panelTitle}>Closest {primaryTrade ? primaryTrade.toLowerCase() + ' suppliers' : 'trade suppliers'}</Text>
              <Text style={S.panelHint}>Tap a pin for directions and shop details. Check stock before travelling.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.nearbyRow}>
                {visible.slice(0, 8).map(shop => (
                  <Pressable
                    key={shop.id}
                    style={S.nearbyShop}
                    onPress={() => {
                      setSelected(shop);
                      mapRef.current?.injectJavaScript('window.focusSupplier(' + shop.latitude + ',' + shop.longitude + ');true;');
                    }}
                  >
                    <Text style={S.nearbyTitle} numberOfLines={1}>{shop.name}</Text>
                    <Text style={S.nearbyDistance}>{shop.distance.toFixed(1)} mi · Directions ↗</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
          <Text style={S.attribution}>Map data © OpenStreetMap contributors · Shop stock and opening times are not live.</Text>
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK, paddingBottom: 80 },
  header: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: INK },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#EFA78B' },
  title: { fontSize: 25, fontWeight: '900', color: LIGHT, marginTop: 3, letterSpacing: -0.6 },
  subtitle: { marginTop: 5, color: '#AAB9C7', fontSize: 12 },
  radiusButton: { backgroundColor: '#23384A', borderWidth: 1, borderColor: '#415469', borderRadius: 13, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, marginLeft: 8, minWidth: 71 },
  radiusNumber: { color: LIGHT, fontSize: 14, fontWeight: '900' },
  radiusCaption: { color: '#AAB9C7', fontSize: 9, fontWeight: '700', marginTop: 2 },
  filters: { paddingTop: 14, paddingRight: 12 },
  chip: { backgroundColor: '#273649', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, marginRight: 8 },
  chipActive: { backgroundColor: '#E9DDCD' },
  chipText: { color: '#B7C3CF', fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#1A2A3B' },
  mapArea: { flex: 1, backgroundColor: '#E7EBEF' },
  webView: { flex: 1, backgroundColor: '#E7EBEF' },
  counter: { position: 'absolute', top: 14, left: 13, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FAF8F4F2' },
  counterText: { fontSize: 11, color: '#1E3444', fontWeight: '900' },
  loading: { position: 'absolute', left: 16, right: 16, top: 70, padding: 13, borderRadius: 12, backgroundColor: '#FDFCF9', flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { color: '#1E3444', fontSize: 11, fontWeight: '700' },
  notice: { position: 'absolute', left: 16, right: 16, top: 65, padding: 13, borderRadius: 12, backgroundColor: '#FDFCF9', alignItems: 'center' },
  noticeText: { color: '#33485B', fontSize: 12, textAlign: 'center' },
  noticeButton: { backgroundColor: '#1A3449', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9, marginTop: 10 },
  noticeButtonText: { color: LIGHT, fontSize: 12, fontWeight: '800' },
  bottomPanel: { position: 'absolute', bottom: 11, left: 11, right: 11, borderRadius: 16, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, backgroundColor: '#FFFCF7F7', shadowColor: '#11273B', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  storeHeader: { flexDirection: 'row', alignItems: 'center' },
  storeGlyph: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#E0EAF1', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  storeGlyphText: { color: '#315F7D', fontSize: 22, fontWeight: '900' },
  storeTitle: { color: '#162B3B', fontSize: 16, fontWeight: '900' },
  storeMeta: { color: '#627283', fontSize: 11, marginTop: 3 },
  close: { padding: 5, marginLeft: 8 },
  closeText: { fontSize: 24, color: '#67788A' },
  address: { color: '#617284', fontSize: 11, marginTop: 8 },
  actions: { flexDirection: 'row', marginTop: 12, gap: 9 },
  primaryButton: { flex: 1, backgroundColor: ACCENT, paddingVertical: 12, borderRadius: 11, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#E1E8ED', paddingHorizontal: 17, borderRadius: 11, justifyContent: 'center' },
  secondaryText: { color: '#244257', fontSize: 12, fontWeight: '800' },
  panelTitle: { color: '#1C3344', fontSize: 14, fontWeight: '900' },
  panelHint: { color: '#697A89', marginTop: 3, fontSize: 10 },
  nearbyRow: { paddingTop: 10, paddingBottom: 4 },
  nearbyShop: { width: 135, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#EAF0F3', marginRight: 8 },
  nearbyTitle: { color: '#1E3547', fontSize: 11, fontWeight: '900' },
  nearbyDistance: { color: '#687D8C', fontSize: 9, marginTop: 3 },
  attribution: { marginTop: 7, fontSize: 8, color: '#82909D' },
});
