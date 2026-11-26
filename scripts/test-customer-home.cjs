const fs=require('node:fs');const assert=require('node:assert/strict');const ts=require('typescript');
const app=fs.readFileSync('App.tsx','utf8'),hero=fs.readFileSync('CustomerHomeMapHero.tsx','utf8');
for(const [file,source] of [['App.tsx',app],['CustomerHomeMapHero.tsx',hero]])assert.equal(ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
assert(app.includes('<CustomerHomeMapHero onPost={trade=>beginFlow(trade)}'));
assert(app.includes("navigate('savedTrades')")&&app.includes("navigate('addressSettings')")&&app.includes('onOpenRequest(requests[0])'));
assert(hero.includes('isReduceMotionEnabled')&&hero.includes('anim.stop()')&&!hero.includes('Illustrated preview'));
assert(app.includes("supabase.rpc('tradarr_unread_conversation_counts')"));
console.log('Customer homepage design and action contract passed.');

assert(hero.includes('height:154')&&hero.includes('accessibilityState={{selected:selected===trade}}'));
assert(hero.includes('onPost(selected||undefined)')&&hero.includes('onExplore(selected||undefined)')&&hero.includes('onPress={onAddress}'));
assert(app.includes("setServiceIntent(null);setSelectedCategory(trade||'All')"));
console.log('Interactive illustrated map selection and filtered actions contract passed.');

const vm=require('node:vm');const motionSource=fs.readFileSync('lib/homeMapMotion.ts','utf8');const moduleBox={exports:{}};vm.runInNewContext(ts.transpileModule(motionSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:moduleBox.exports});const {isHomePan,clampHomePan,settleHomePan}=moduleBox.exports;
assert(isHomePan(25,5));assert(!isHomePan(8,0));assert(!isHomePan(10,40));assert.equal(clampHomePan(999,-999,360,154).x,90);assert.equal(clampHomePan(999,-999,360,154).y,-154*.065);assert.equal(settleHomePan({x:30,y:0},{x:9,y:0},360,154).x,90);assert.equal(settleHomePan({x:0,y:0},{x:0,y:0},360,154).x,0);
assert(hero.includes('PanResponder.create')&&hero.includes('pan.getTranslateTransform()')&&hero.includes('Recenter trade map')&&hero.includes('viewBox="-108 -33 576 231"'));console.log('Home map drag bounds, momentum and layout contract passed.');
