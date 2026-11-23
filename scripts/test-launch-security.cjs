const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=relative=>fs.readFileSync(path.join(process.cwd(),relative),'utf8');
const clock=read('supabase/migrations/20261123113657_tradarr_booking_slots_uk_clock_change_validation.sql');
const indexes=read('supabase/migrations/20261123114423_tradarr_launch_core_foreign_key_indexes.sql');
const security=read('supabase/tests/tradarr_launch_security_read_only.sql');

assert.match(clock,/create or replace function public\.tradarr_suggest_booking_slots/i);
assert.match(clock,/earliest\s*:=\s*\(?local_start at time zone 'UTC'\)?\s*-\s*interval '1 hour'/i);
assert.match(clock,/if\s*\(earliest at time zone 'Europe\/London'\)\s*<>\s*local_start\s*then\s+continue;/i);
assert.match(clock,/trade_private\.tradarr_account_suspended/i);
assert.match(clock,/trade_private\.tradarr_trade_paused/i);
assert.match(clock,/and a\.status='scheduled'/i);
assert.match(clock,/and a\.starts_at<latest and a\.ends_at>earliest/i);

const expected=[
 'trade_appointments(customer_id)',
 'trade_route_plans(tradesperson_id)',
 'trade_route_plans(anchor_appointment_id)',
 'trade_customer_proposals(job_id)',
 'trade_customer_proposals(urgent_request_id)',
 'trade_invoices(customer_id)',
 'trade_quotes(customer_id)',
 'tradarr_safety_reports(reporter_id)',
 'tradarr_user_blocks(blocked_id)',
 'tradarr_push_outbox(recipient_id)'
];
for(const target of expected){
 assert(indexes.includes('public.'+target),'Missing launch FK index: '+target);
}
assert.equal((indexes.match(/create index if not exists/gi)||[]).length,expected.length);
assert.doesNotMatch(indexes,/\bdrop\s+(table|index|policy)|\balter\s+table|\bdelete\s+from|\btruncate\b/i);

const privateTables=['profiles','tradesperson_profiles','jobs','job_offers',
 'job_locations','conversations','messages','trade_appointments','trade_invoices',
 'support_requests','tradarr_notifications','tradarr_push_devices',
 'tradarr_safety_reports','tradarr_account_deletion_requests'];
for(const name of privateTables){
 assert(security.includes("'"+name+"'"),'Missing core table RLS gate: '+name);
}
assert(security.includes("has_function_privilege('anon',x.oid,'EXECUTE')"));
assert(security.includes("has_function_privilege('authenticated',x.oid,'EXECUTE')"));
assert(security.includes("trade_private.tradarr_staff_authorised()"));
assert(security.includes("auth.sessions")&&security.includes("raw_app_meta_data")&&security.includes("aal2"));
assert(!security.includes('grant select to anon'));
console.log('PASS launch security baseline, UK DST-safe booking migration and 10 additive FK indexes');
