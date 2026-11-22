const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('AuthScreen.tsx','utf8');
const recovery=fs.readFileSync('PasswordRecoveryScreen.tsx','utf8');
const anchor='const normaliseUkMobile = (value: string) => {';
const start=src.indexOf(anchor),end=src.indexOf('\n};',start);
assert.ok(start>0&&end>start,'Native UK mobile parser not found');
const body=src.slice(start+anchor.length,end);
const parse=new Function('value',body);
const valid=['07911123456','+44 7911 123456','447911123456','00447911123456','7911123456'];
for(const phone of valid){
 const formatted=parse(phone);
 assert.equal(formatted,'07911123456',phone);
 assert.match(formatted,/^07\d{9}$/,phone);
}
for(const invalid of ['0700','01234','5555555555','071234567890','447123abc']){
 assert.doesNotMatch(parse(invalid),/^07\d{9}$/,invalid);
}
assert.ok(src.includes('onChangeText={setPhone}'),'Do not coerce a partial mobile number while typing');
assert.ok(src.includes('maxLength={20}'),'Accept international input until submission');
assert.ok(src.includes('setLoading(false);'),'Auth loading states must be reset');
assert.ok(src.includes('this is a developing marketplace'),'Honest pilot wording required');
assert.ok(!recovery.includes('TradeHub'),'Legacy branding still in recovery');
assert.ok(recovery.includes('Trad<Text style={styles.brandAccent}>arr</Text>'),'Tradarr recovery branding missing');
console.log('PASS UK mobile formats, invalid numbers, pilot wording and recovery brand');


const supabase=fs.readFileSync('lib/supabase.ts','utf8');
assert(supabase.includes("TRADARR_AUTH_HOST='sjwedfdwqxfrnpruiqnq.supabase.co'"),
 'The native app must point at the shared Supabase Auth project');
assert(supabase.includes("supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL"),
 'The native client must use its configured project URL');
assert(supabase.includes("supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
 'The native app must use a publishable, not privileged key');
assert(supabase.includes('!sharedAccountProject'),
 'Reject an unrelated backend rather than registering a separate website account');
assert(src.includes('supabase.auth.signInWithPassword'),
 'The iPhone app must use shared Supabase password sign-in');
assert(src.includes('supabase.auth.signUp'),
 'The iPhone app must use shared Supabase signup');
console.log('PASS iPhone and website share one identity project');
