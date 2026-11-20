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
// Form step transitions must keep the sheet mounted while maintaining a
// continuous way back from stage three to two to one.
assert.ok(motion.includes('export function FlowStep('));
assert.ok(motion.includes('export function FlowProgressSegment('));
assert.ok(motion.includes('export function ChoiceIndicator('));
assert.ok(app.includes('<FlowStep key={flowStep} direction={flowDirection}>'));
assert.ok(app.includes('<FlowProgressSegment key={step} active={step <= flowStep}/>'));
assert.ok(app.includes('<ChoiceIndicator active={flowTiming === timing}'));
assert.ok(app.includes('setFlowDirection(-1);setFlowStep(1)'));
assert.ok(app.includes('setFlowDirection(-1);setFlowStep(2)'));
assert.ok(app.includes('setFlowDirection(1);'));
assert.ok(app.includes('<StatusSwap value={available}>'),
 'Availability status must animate only after persisted state updates');
assert.ok(motion.includes('previous.current===value'),
 'Status should not animate on every re-render');
assert.ok(motion.includes('if(reduced){motion.stopAnimation();motion.setValue(1)'),
 'Reduced motion must disable status swapping');
assert.ok(motion.includes('export function ContentSwap('),
 'Job view filter change should have a stable content transition');
assert.ok(app.includes('<ContentSwap value={jobsView+'),
 'Jobs must animate when the selected view or offer filter changes');
assert.ok(app.includes("<NavPill active={jobsView === 'offers'}"),
 'Jobs screen should animate the segmented selection');
assert.ok(app.includes('<FadeSlideIn>\\n          <View style={styles.tradeHowPanel}>') ||
 app.includes('<FadeSlideIn>\n          <View style={styles.tradeHowPanel}>'),
 'Expanded job guidance needs an entrance');
assert.ok(motion.includes('React.useLayoutEffect('),
 'Status and content transitions should set the animation starting state before paint');
assert.ok(motion.includes('export function MapCardReveal('));
assert.ok(app.includes('<MapCardReveal key={selectedMapTrade.id} style={styles.mapPreviewCard}>'),
 'Customer map card should animate without detaching from its absolute map anchor');
assert.ok(motion.includes('function useAppForeground()'),
 'Decorative animations must stop when app is backgrounded');
assert.ok(motion.includes("AppState.addEventListener('change'"),
 'Background pause should respond to app state changes');
assert.ok(motion.includes('if(reduced||!foreground)'),
 'Decorative loops should stop both for accessibility and background');
console.log('Motion regression passed: map scripts, job wizard steps, availability confirmation, low bounce and accessibility.');
