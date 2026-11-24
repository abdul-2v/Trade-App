// Protect the chosen system typography and category-first Tradarr Tools design.
// The map and Inbox fixes have separate regression checks.
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
const labels=['Quotes & finance','Jobs & scheduling','Documents & reports','Materials & suppliers','Customers & team'];
for(const label of labels)assert.ok(screen.includes("title:'"+label+"'"),'Missing category '+label);
assert.ok(screen.includes("const [category,setCategory]=useState('')"),'Categories need their own screen state');
assert.ok(screen.includes("onPress={()=>setCategory(group.id)}"),'Category cards must open the selected category');
assert.ok(screen.includes('selected.tools.map('),'A category must show only its own tools');
assert.ok(screen.includes("onPress={()=>setCategory('')}"),'A category needs an All categories back action');
assert.ok(screen.includes('style={styles.tradeToolsUnifiedList}'),'Category tools should share a consistent list');
assert.ok(screen.includes('style={[styles.tradeToolsUnifiedRow,'),'All individual tools should use uniform rows');
assert.ok(screen.includes("route:'tradeInvoices',title:'Invoices & payments'"),
 'Invoices should remain a normal tool row, not a hero');
assert.ok(screen.indexOf("route:'tradeInvoices'")<screen.indexOf("route:'tradeQuotes'"),
 'Invoices must be listed before quotes');
assert.ok(screen.includes("route:'tradeDocuments',title:'Create job documents'"),
 'The document creator must be discoverable in Documents & reports');
assert.ok(app.includes("tradeScreen === 'tradeDocuments'"),'Trade document screen route must work');
assert.ok(app.includes("customerScreen === 'customerDocuments'"),'Customer document screen route must work');
assert.ok(!screen.includes('tradeToolsFeatured'), 'No oversized invoice hero');
assert.ok(!screen.includes('tradeInvoiceHero'), 'Do not isolate invoices in a hero');
assert.ok(!screen.includes('tradeToolsQuickCard'), 'Do not isolate invoice shortcuts');
assert.ok(!screen.includes('tradeToolsPowerCard'), 'Keep consistent category cards');
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
// Shortcuts use the real existing composers, rather than opening a list.
for(const [route,file,guard] of [
 ['tradeInvoices','TradeInvoicesScreen.tsx',"if(!initialPreviewId&&screen==='list')startNew()"],
 ['tradeQuotes','TradeQuotesScreen.tsx',"if(!initialDraft&&screen==='list')newQuote()"],
 ['tradeDiary','TradeDiaryScreen.tsx',"if(!editing)startNew()"],
]){
 assert.ok(screen.includes("navigate('"+route+"',true)"),'Shortcut must request create mode for '+route);
 assert.ok(app.includes("initialCreate={tradeCreateEntry==='"+route+"'}"),'Create intent must reach '+route);
 const composer=read(file);
 assert.ok(composer.includes('handledCreate.current=true')&&composer.includes(guard)&&composer.includes('onCreateOpened?.()'),
  'Create mode must wait, open the original composer and consume its intent: '+route);
}
assert.equal((screen.match(/(?:route|feature):'/g)||[]).length,25,'All 25 tools must be retained');
assert.ok(screen.includes('fontScale>1.2')&&screen.includes('wide=compact'),'Large text must switch to wide cards');
assert.ok(app.includes('tradeToolsTileBody:{flex:1,minWidth:0,justifyContent:'),'Card content must flex without truncation');
const orbit=app.slice(app.indexOf('function TradeToolsOrbit'),start);
assert.ok(orbit.includes('useNativeDriver:true')&&orbit.includes('isInteraction:false'),'Native decoration must not block user interaction');
assert.ok(orbit.includes('if(reduced||!foreground)return')&&orbit.includes('animation.stop()'),'Animation must pause and clean up');
console.log('PASS: system fonts, category-first Tools, invoices first, unique actions, light map and clean Inbox');
