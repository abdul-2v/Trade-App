// Parse the JavaScript embedded in both Leaflet map WebViews and the
// MapLibre home preview. TSX syntax checks alone cannot inspect script strings.
const assert=require('node:assert/strict');
const fs=require('node:fs');
function file(name){return fs.readFileSync(name,'utf8');}
function inlineJS(name){
 const matches=[...file(name).matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(matches.length,1,name+' must contain one inline map script');
 const src=matches[0][1].replace(/\$\{[^}]+\}/g,'null');
 assert.doesNotThrow(()=>new Function(src),name+' embedded map JavaScript is invalid');
 return src;
}
const customer=inlineJS('App.tsx');
const merchant=inlineJS('TradeSuppliersMap.tsx');
const home=inlineJS('WorkAreaMapPreview.tsx');
const app=file('App.tsx');
const supplier=file('TradeSuppliersMap.tsx');
const motion=file('Motion.tsx');
const preview=file('WorkAreaMapPreview.tsx');
// Focus moves to a chosen pin; it must not widen to a faraway point or cover
// the merchant with the details panel.
assert.ok(customer.includes('const safeY='));
assert.ok(merchant.includes('var safeTop='));
assert.ok(!customer.includes('map.fitBounds('),
 'The customer map must not zoom out to include every UK trader');
assert.ok(!merchant.includes('shopLink=L.polyline'),
 'A decorative straight-line journey must not be presented as road travel');
assert.ok(supplier.includes('<Animated.View style={[S.bottomPanel,'),
 'Merchant detail card should have a bounded entrance animation');
assert.ok(preview.includes('merchantGlow .8s ease-out 1 both'),
 'Home merchant markers should have a finite, not perpetual, glow');
assert.ok(motion.includes('useSyncExternalStore'),
 'Reduced Motion changes must stop decorative loops');
assert.ok(!motion.includes('Animated.spring(scale'),
 'Buttons should not spring-bounce while tapping');
assert.ok(app.includes('body.dense-map .trade-pin'),
 'Dense map should stop unnecessary animations');
assert.ok(app.includes('@media(prefers-reduced-motion:reduce)'));
assert.ok(supplier.includes('@media(prefers-reduced-motion:reduce)'));
assert.ok(preview.includes('@media(prefers-reduced-motion:reduce)'));
console.log('Motion regression passed: 3 map scripts parse, focus camera, bounded markers, button feel and reduced-motion checks.');
