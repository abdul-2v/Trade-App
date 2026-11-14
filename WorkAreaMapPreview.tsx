import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

type WorkAreaMapPreviewProps = {
  latitude: number;
  longitude: number;
  showPin: boolean;
};

/** Lightweight, view-only map. The full merchant finder lives in the Map tab. */
export default function WorkAreaMapPreview({ latitude, longitude, showPin }: WorkAreaMapPreviewProps) {
  const lat = Number.isFinite(latitude) && Math.abs(latitude) <= 90 ? Number(latitude.toFixed(4)) : 52.6369;
  const lon = Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? Number(longitude.toFixed(4)) : -1.1398;
  const html = useMemo(() => `
<!doctype html>
<html lang="en"><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" />
<style>
html,body,#map{width:100%;height:100%;margin:0;overflow:hidden;background:#E8EFF1;}
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;}
#fallback{position:absolute;inset:0;z-index:2;display:flex;justify-content:center;align-items:center;color:#657B8D;
background:repeating-linear-gradient(35deg,#E6ECEF 0px,#E6ECEF 29px,#F5F7F5 31px,#F5F7F5 50px);font-size:12px;}
.pin{width:23px;height:23px;border:5px solid white;border-radius:50%;background:#CE7052;
box-shadow:0 0 0 6px rgba(206,112,82,.20),0 4px 14px #203E5555;box-sizing:border-box;}
.maplibregl-control-container{display:none}
#attribution{position:absolute;z-index:4;right:5px;bottom:3px;background:#ffffffc4;color:#637683;font-size:8px;padding:2px 4px;border-radius:4px}
</style></head><body>
<div id="fallback">Work area preview</div><div id="map"></div>
<div id="attribution">© OpenStreetMap contributors · OpenFreeMap</div>
<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<script>
try {
  var map = new maplibregl.Map({
    container:'map',style:'https://tiles.openfreemap.org/styles/liberty',
    center:[${lon},${lat}],zoom:11.9,interactive:false,attributionControl:false,fadeDuration:0
  });
  map.on('load',function(){
    document.getElementById('fallback').style.display='none';
    if(${showPin ? 'true' : 'false'}){
      var dot=document.createElement('div');dot.className='pin';
      new maplibregl.Marker({element:dot,anchor:'center'}).setLngLat([${lon},${lat}]).addTo(map);
    }
  });
}catch(error){ document.getElementById('fallback').textContent='Open map to explore your area'; }
</script></body></html>`, [lat, lon, showPin]);

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
  frame: { width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#E8EFF1' },
  webview: { flex: 1, backgroundColor: '#E8EFF1' },
});
