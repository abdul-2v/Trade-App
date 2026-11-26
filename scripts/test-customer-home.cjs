const fs=require('node:fs');const assert=require('node:assert/strict');const ts=require('typescript');
const app=fs.readFileSync('App.tsx','utf8'),hero=fs.readFileSync('CustomerHomeMapHero.tsx','utf8');
for(const [file,source] of [['App.tsx',app],['CustomerHomeMapHero.tsx',hero]])assert.equal(ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
assert(app.includes('<CustomerHomeMapHero onPost={()=>beginFlow()}'));
assert(app.includes("navigate('savedTrades')")&&app.includes("navigate('addressSettings')")&&app.includes('onOpenRequest(requests[0])'));
assert(hero.includes('isReduceMotionEnabled')&&hero.includes('anim.stop()')&&!hero.includes('Illustrated preview'));
assert(app.includes("supabase.rpc('tradarr_unread_conversation_counts')"));
console.log('Customer homepage design and action contract passed.');

assert(hero.includes('height:154')&&hero.includes('pointerEvents="none" accessibilityElementsHidden'));
assert(hero.includes('onPress={onPost}')&&hero.includes('onPress={onExplore}'));
assert(!/PanResponder|onPress=\{switchGroup\}|More trades|Recenter trade map|selectedPin/.test(hero));
assert(hero.includes('useNativeDriver:true')&&hero.includes('Easing.linear')&&hero.includes('!foreground'));
const vm=require('node:vm');const motionSource=fs.readFileSync('lib/homeMapMotion.ts','utf8');const moduleBox={exports:{}};vm.runInNewContext(ts.transpileModule(motionSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:moduleBox.exports});const {HOME_MAP_DURATION,HOME_MAP_SIGNALS,HOME_MAP_ORIGIN}=moduleBox.exports;
assert.equal(HOME_MAP_DURATION,6800);assert.equal(HOME_MAP_SIGNALS.length,3);
for(const signal of HOME_MAP_SIGNALS){assert(signal.start>0&&signal.start+.18+.16<1);assert(signal.x>=0&&signal.x<=360&&signal.y>=0&&signal.y<=165);}
assert.equal(HOME_MAP_ORIGIN.x,173);
console.log('Decorative network animation, scroll isolation and clear homepage actions contract passed.');
