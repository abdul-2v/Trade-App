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
assert.ok(screen.includes("onPress={()=>{setCategory(group.id);setToolPage(0)}}"),'Category cards must open the selected category');
assert.ok(screen.includes('selected.tools.slice('),'A category must show only its own tools');
assert.ok(screen.includes("onPress={()=>{setCategory('');setToolPage(0)}}"),'A category needs an All categories back action');
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
assert.ok(screen.includes('fontScale>1.2')&&screen.includes('wide=compact||index===groups.length-1'),'Large text must switch to wide cards');
assert.ok(app.includes('tradeToolsTileBody:{flex:1,minWidth:0,justifyContent:'),'Card content must flex without truncation');
const orbit=app.slice(app.indexOf('function TradeToolsOrbit'),start);
assert.ok(orbit.includes('useNativeDriver:true')&&orbit.includes('isInteraction:false'),'Native decoration must not block user interaction');
assert.ok(orbit.includes('if(reduced||!foreground)return')&&orbit.includes('animation.stop()'),'Animation must pause and clean up');
console.log('PASS: system fonts, category-first Tools, invoices first, unique actions, light map and clean Inbox');

 // Jobs layout and direct availability controls: protect matching and location preferences.
const jobsStart=app.indexOf('function TradeJobsScreen(');
const jobsEnd=app.indexOf('function TradeMapScreen(',jobsStart);
const jobs=app.slice(jobsStart,jobsEnd);
const writer=jobs.slice(jobs.indexOf('const changeJobsAvailability='),jobs.indexOf('const loadJobs ='));
assert.ok(writer.includes(".from('trade_availability')")&&writer.includes(".eq('user_id',user.id)"),'Jobs must persist availability for the authenticated trader');
assert.ok(writer.includes('is_available:next')&&writer.includes('available_until:next?')&&!writer.includes('radius_miles')&&!writer.includes('location_mode'),'Toggle must preserve saved radius and location privacy');
assert.ok(writer.includes('availabilityRequest.current+=1')&&writer.includes('availabilityWrite.current=true'),'Pending reads and duplicate writes must be guarded');
assert.ok(writer.indexOf('setIsReceivingOffers(confirmed)')>writer.indexOf('if(error||!saved)'),'Online label must follow server confirmation');
assert.ok(jobs.includes('changeJobsAvailability(!isReceivingOffers)')&&jobs.includes('accessibilityRole="switch"'),'Jobs availability is actionable on the page');
assert.ok(jobs.indexOf('styles.premiumJobOverview')<jobs.indexOf('styles.premiumSegment')&&jobs.indexOf('styles.premiumSegment')<jobs.indexOf('styles.tradeOfflineBanner'),'Summary and offer tabs must precede availability');
assert.ok(jobs.includes('pageJob?<View')&&jobs.includes('loading||loadingMarket?')&&jobs.includes('offersLoadError?')&&jobs.includes("jobsView==='active'?"),'Only a successfully loaded empty offers view gets the illustration');
assert.ok(jobs.includes('<TradeJobsEmptyMotion online={isReceivingOffers}/>'),'Empty state must have native motion');
const emptyArt=app.slice(app.indexOf('function TradeJobsEmptyMotion('),jobsStart);
assert.ok(emptyArt.includes('useNativeDriver:true')&&emptyArt.includes('isInteraction:false')&&emptyArt.includes('if(reduce||!foreground)return')&&emptyArt.includes('loop.stop()'),'Empty animation must be native, nonblocking and respect accessibility/background');
console.log('PASS: direct Jobs availability, preserved privacy settings, compact layout and accessible animation');

assert.ok(jobs.includes('if(offerError)throw offerError')&&jobs.includes('if(requestError)throw requestError')&&jobs.includes('if(jobError)throw jobError'),'Failed requests cannot become empty offers');
assert.ok(jobs.includes('urgentRequest.current')&&jobs.includes('marketRequest.current'),'Stale refresh responses must not overwrite newer requests');
assert.ok(jobs.includes('tradeJobsSwitchTrackOn')&&!jobs.includes('onValueChange={()=>{}}'),'Availability card itself is the one real switch action');

// Supplier map uses the same native type hierarchy as the Tools and Jobs screens.
// Retain the existing compact header, sheet and map viewport; only typography changes.
const supplierStyle=(name)=>map.split('\n').find(line=>line.trimStart().startsWith(name+':'));
assert.ok(supplierStyle('title').includes('fontFamily:theme.font.editorial')&&supplierStyle('title').includes('fontWeight:theme.type.titleWeight'),'Map title must match the native app heading');
assert.ok(supplierStyle('panelTitle').includes('fontWeight: theme.type.sectionWeight'),'Nearby suppliers heading must use the shared bold section weight');
assert.ok(supplierStyle('chipText').includes("fontWeight:'700'")&&supplierStyle('chipTextActive').includes("fontWeight:'800'"),'Supplier filter typography must match the app');
assert.ok(supplierStyle('radiusNumber').includes("fontWeight:'800'"),'Radius numeral must match the app');
assert.ok(supplierStyle('panelHint').includes('fontFamily: theme.font.body')&&supplierStyle('subtitle').includes('fontFamily:theme.font.body'),'Use the native body font');
assert.ok(map.includes('mapArea:{flex:1')&&map.includes("bottomPanel:{position:'absolute',bottom:11,left:12,right:12"),'Map and nearby sheet must retain their layout');
console.log('PASS: matching supplier map typography, unchanged map and sheet geometry');
