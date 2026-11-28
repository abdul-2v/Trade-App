import assert from 'node:assert/strict';
import {emailKinds,renderEmail,retryableStatus} from '../supabase/functions/tradarr-email-dispatch/templates.mjs';
assert.equal(emailKinds.length,14);
for(const kind of emailKinds){const t=renderEmail(kind,'https://example.test');assert.ok(t.subject&&t.text&&t.html);assert.ok(t.html.includes('https://example.test/app')&&t.text.includes('https://example.test/app'));}
for(const origin of ['http://example.test','https://user@example.test','https://example.test/path','https://example.test/?x=1','javascript:alert(1)'])assert.throws(()=>renderEmail('job_status',origin));
assert.throws(()=>renderEmail('__proto__','https://example.test'));
assert.equal(retryableStatus(429),true);assert.equal(retryableStatus(503),true);
assert.equal(retryableStatus(409,'concurrent_idempotent_requests'),true);
assert.equal(retryableStatus(409,'invalid_idempotent_request'),false);
assert.equal(retryableStatus(401),false);
console.log('14 shared email templates and retry guard checks passed');
