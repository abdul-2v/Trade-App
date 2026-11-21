// Protect the user's chosen plain sans-serif Tradarr design and a single
// uniform Tools list. The map and Inbox fixes have separate regression checks.
// Source checks cannot replace screenshots on a real iPhone.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const app=read('App.tsx');
const theme=read('theme.ts');
const map=read('TradeSuppliersMap.tsx');
const inbox=read('InboxEmptyMotion.tsx');
const start=app.indexOf('function TradeToolsScreen({navigate,openBusinessSuite}:{');
const end=app.indexOf('\nfunction TradeHomeScreen(',start);
assert.ok(start>=0&&end>start,'Tools screen must exist');
const screen=app.slice(start,end);
const labels=['Everyday essentials','Find & organise work','Quotes, money & materials','Customers & growth','People & insights'];
for(const label of labels)assert.ok(screen.includes("title:'"+label+"'"),'Missing category '+label);
assert.ok(screen.includes('groups.map((group,groupIndex)'), 'All categories should be part of one ordered list');
assert.ok(screen.includes('style={styles.tradeToolsUnifiedList}'),'All tools should share ONE list surface');
assert.ok(screen.includes('style={[styles.tradeToolsUnifiedRow,'),'Every tool must have the same row design');
assert.ok(screen.includes("route:'tradeInvoices',title:'Invoices & payments'"),
 'Invoices must stay at the top as a NORMAL row rather than a hero card');
assert.ok(screen.indexOf("route:'tradeInvoices'")<screen.indexOf("route:'tradeQuotes'"),
 'Invoices must be listed before quotes');
assert.ok(!screen.includes('tradeToolsFeatured'), 'Do not bring back oversized featured invoice card');
assert.ok(!screen.includes('tradeInvoiceHero'),'Do not isolate invoices as a hero');
assert.ok(!screen.includes('tradeToolsQuickCard'),'Do not isolate quick actions as oversized cards');
assert.ok(!screen.includes('activeCategory'),'Do not hide tools behind accordions');
assert.ok(!screen.includes('tradeToolsPowerCard'),'Do not bring back mixed card treatments');
const routes=['tradeInvoices','tradeQuotes','tradeDiary','tradeHours','tradeProfit','tradeCrew','tradeMaterials',
 'tradeGrid','tradeRoutes','tradePro','tradeCollective','tradeCustomers'];
for(const route of routes){
 const count=(screen.match(new RegExp("route:'"+route+"'","g"))||[]).length;
 assert.equal(count,1,'Route '+route+' needs exactly one entry');
}
const features=['quoteStudio','moneyHub','radar','crewOps','assistant','insights','documentVault',
 'growthKit','bookingProfile','repeatEngine','smartDiary','commandCentre'];
for(const feature of features){
 const count=(screen.match(new RegExp("feature:'"+feature+"'","g"))||[]).length;
 assert.equal(count,1,'Feature '+feature+' needs exactly one entry');
}
assert.ok(screen.includes('item.route?navigate(item.route):item.feature?openBusinessSuite(item.feature)'),
 'All rows need a real action');
assert.ok(!theme.includes("'Georgia'"),'Restore original native sans-serif: no Georgia');
assert.ok(!theme.includes("'Menlo'"),'Restore familiar number styles: no monospaced Menlo');
for(const token of ['editorial','heading','body','numeric']){
 assert.ok(theme.includes(token+": Platform.OS==='ios'?'System':'sans-serif'"),
  token+' must use iPhone system font');
}
assert.ok(map.includes('styles/positron'),'Keep the light merchant map');
assert.ok(!map.includes('brightness(.91) contrast(.99)'),'Do not retint the merchant map');
assert.ok(map.includes('searchExpanded')&&map.includes('nearbyExpanded'),
 'Keep map search and supplier panel collapsible');
assert.ok(map.includes('openDirections(selected)'),'Keep merchant directions intact');
assert.ok(inbox.includes('const receiveScale = flight.interpolate('),'Keep Inbox animation');
assert.ok(!inbox.includes('recipientAura')&&!inbox.includes('receiveGlow'),
 'Keep unwanted receiver orange glow removed');
console.log('PASS: system fonts, flat Tools list, invoices first, unique actions, light map and clean Inbox');
