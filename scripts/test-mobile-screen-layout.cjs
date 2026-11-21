// Guard the three layouts corrected after iPhone screenshot review.
// These source-level assertions cannot substitute for real iPhone screenshot QA.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=p=>fs.readFileSync(p,'utf8');
const app=source('App.tsx'),map=source('TradeSuppliersMap.tsx'),inbox=source('InboxEmptyMotion.tsx');
const start=app.indexOf('function TradeToolsScreen({navigate,openBusinessSuite}:{');
const end=app.indexOf('\nfunction TradeHomeScreen(',start);
assert.ok(start>=0&&end>start,'Native Tools screen must exist');
const tools=app.slice(start,end);
const groups=['Jobs & scheduling','Quotes, money & materials','Customers & growth','Team & insights'];
for(const group of groups)assert.ok(tools.includes("title:'"+group+"'"),'Missing Tools category: '+group);
assert.ok(tools.includes('groups.map((group,index)'), 'Grouped tools must render consistently');
assert.ok(tools.includes('Browse your toolkit'),'Tool categories need a visible hierarchy');
assert.ok(tools.includes('activeCategory===index?<View'),'Only one group should be open, to keep the Tools page scannable');
assert.ok(tools.includes('accessibilityState={{expanded:activeCategory===index}}'),'Category expansion needs screen-reader state');
assert.ok(tools.includes("onPress={()=>navigate('tradeInvoices')}"),'Invoice action must work');
for(const route of ['tradeHours','tradeProfit','tradeCrew','tradeMaterials','tradeGrid',
 'tradeRoutes','tradePro','tradeCollective','tradeCustomers']){
 const matches=tools.match(new RegExp("route:'"+route+"'","g"))||[];
 assert.equal(matches.length,1,'Route '+route+' should appear in exactly one Tools category');
}
for(const feature of ['quoteStudio','moneyHub','radar','crewOps','assistant','insights']){
 const matches=tools.match(new RegExp("feature:'"+feature+"'","g"))||[];
 assert.equal(matches.length,1,'Feature '+feature+' should have a single Tools entry');
}
assert.ok(map.includes('styles/positron'),'Merchant basemap should be light neutral');
assert.ok(!map.includes('brightness(.91) contrast(.99)'),'No tinted map filter');
assert.ok(map.includes('searchExpanded')&&map.includes('setSearchExpanded'),'Search must collapse');
assert.ok(map.includes('nearbyExpanded')&&map.includes('setNearbyExpanded'),'Nearby shop sheet must collapse');
assert.ok(map.includes('visible.slice(0,8)'),'Expanded sheet retains real nearest shops');
assert.ok(map.includes('window.focusSupplier'),'Tapping a real merchant must focus its map pin');
assert.ok(map.includes('openDirections(selected)'),'Selected shop directions must remain accessible');
assert.ok(map.includes('window.showSuppliers'),'Actual supplier markers must still render');
assert.ok(map.includes('accessibilityState={{expanded:nearbyExpanded}}'),'Sheet must expose expanded state to VoiceOver');
assert.ok(inbox.includes('const receiveScale = flight.interpolate('),'Message travel animation remains');
assert.ok(inbox.includes('<Animated.View pointerEvents="none"'),'Send animation remains');
assert.ok(!inbox.includes('recipientAura'),'The orange ring behind the receiver must not return');
assert.ok(!inbox.includes('receiveGlow'),'Unwanted glow animation must not return');
console.log('PASS: four Tools categories, unique destinations, map readability, compact expandable sheet and halo-free Inbox');
