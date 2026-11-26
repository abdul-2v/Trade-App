const fs=require('node:fs');const assert=require('node:assert/strict');const ts=require('typescript');
const app=fs.readFileSync('App.tsx','utf8'),hero=fs.readFileSync('CustomerHomeMapHero.tsx','utf8');
for(const [file,source] of [['App.tsx',app],['CustomerHomeMapHero.tsx',hero]])assert.equal(ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
assert(app.includes('<CustomerHomeMapHero onPost={()=>beginFlow()}'));
assert(app.includes("navigate('savedTrades')")&&app.includes("navigate('addressSettings')")&&app.includes('onOpenRequest(requests[0])'));
assert(hero.includes('isReduceMotionEnabled')&&hero.includes('anim.stop()')&&hero.includes('Illustrated preview'));
assert(app.includes("supabase.rpc('tradarr_unread_conversation_counts')"));
console.log('Customer homepage design and action contract passed.');
