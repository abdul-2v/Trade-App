const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('lib/notificationDestination.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText;
const mod={exports:{}};
new Function('module','exports',code)(mod,mod.exports);
const {resolveNotificationTarget:resolve}=mod.exports;
const id='c884200a-3e39-4c15-8843-d2ceaa312999';
const eq=(actual,expected)=>assert.equal(actual,expected);
eq(resolve('customer','message',{conversationId:id}).screen,'messages');
eq(resolve('customer','message',{conversationId:id}).conversationId,id);
eq(resolve('tradesperson','message',{conversationId:id}).screen,'tradeMessages');
eq(resolve('customer','message',{conversationId:'https://example.com/phishing'}).conversationId,null);
eq(resolve('customer','admin_notice',{}).activity,true);
eq(resolve('tradesperson','admin_notice',{}).activity,true);
eq(resolve('customer','invoice_update',{}).screen,'customerInvoices');
eq(resolve('tradesperson','invoice_update',{}).screen,'tradeInvoices');
eq(resolve('customer','quote_update',{}).screen,'customerQuotes');
eq(resolve('tradesperson','quote_update',{}).screen,'tradeQuotes');
eq(resolve('tradesperson','appointment_reminder',{}).screen,'tradeDiary');
eq(resolve('tradesperson','route_match',{}).screen,'tradeRoutes');
eq(resolve('tradesperson','verification_update',{}).screen,'tradeTrust');
eq(resolve('tradesperson','crew_update',{}).screen,'tradeCrew');
eq(resolve('tradesperson','support_update',{}).screen,'tradeSupport');
eq(resolve('customer','support_update',{}).screen,'customerSupport');
eq(resolve('customer','job_accepted',{}).screen,'requests');
eq(resolve('tradesperson','job_offer',{}).screen,'tradeJobs');
eq(resolve('tradesperson','job_offer',{screen:'accountSafety'}).screen,'tradeSafety');
eq(resolve('crew','crew_update',{conversationId:id}).screen,'crew');
eq(resolve('crew','crew_update',{conversationId:id}).conversationId,null);
const inbox=fs.readFileSync('TradarrNotificationsScreen.tsx','utf8');
assert(inbox.includes('const refreshVersion=useRef(0)'),
 'Newer notification refreshes must invalidate older results');
assert(inbox.includes('if(version!==refreshVersion.current)return'),
 'Out-of-order response must not overwrite fresh notifications');
assert(inbox.includes("setUid('');setItems([]);setHasOlder(false);setTotalUnread(0)"),
 'Signed-out users must not see previous notification contents');
assert(inbox.includes('if(activeUserRef.current!==user.id)'),
 'Switching accounts must discard previous account notification state');
assert(inbox.includes('.or(historyBefore(oldest))')&&inbox.includes(".order('id',{ascending:false})"),
 'Use keyset pagination to avoid missing alerts when new notifications arrive');
assert(!inbox.includes('.range(items.length,items.length+PAGE_SIZE-1)'),
 'Offset paging skips records under concurrent notification inserts');

console.log('Native notification destination tests passed (roles, quotes, chats, safety and malformed IDs).');
