# ScopeGuard + FinishProof — release and safety checklist

## Purpose
ScopeGuard saves proposed additional work, the price *difference* in exact pence, and extra minutes. Only the customer can approve or decline the proposal; the assigned tradesperson can withdraw it. This is a written record, **not** an automatic amendment to an accepted quote, invoice, diary booking, or payment.

FinishProof captures a tradesperson's factual completed-work summary, a three-part checklist, up to three private images, aftercare notes, and an optional customer follow-up request. Acknowledgment only confirms receipt; it is **not** a legal waiver, independent inspection, certification, or warranty.

Both are accessible from customer and tradesperson **Jobs**; the website also links them from both **Tools** sections.

## Already verified in development
- [x] Live Supabase migration `20261121143606_tradarr_scopeguard_finishproof_20261121` applied to the Tradarr project and checked into the website and Expo repositories with the exact version
- [x] Scope, handover and aftercare tables have RLS enabled; authenticated role can SELECT but cannot directly INSERT, UPDATE or DELETE
- [x] Five RPCs callable by authenticated clients but not anonymous users, with server-side participant and job-status checks
- [x] Private `tradarr-finishproof` storage bucket, 4MB image limit, owner-based upload and cleanup, only customer/trader download access, 90-second signed URLs
- [x] Partial unique index prevents more than one simultaneous pending proposal for a job
- [x] Web source and tests pass GitHub Actions (`npm run build` / `npm run check`)
- [x] Native TypeScript, Expo compatibility and logic checks pass GitHub Actions

## Mandatory before public launch — two physical accounts
Use **two separate test accounts**, not two views of one staff account, with one genuine test standard job. Prefer a non-production staging project with an identical migration and isolated test records.

### ScopeGuard
- [ ] Customer posts a job and assigns a tradesperson. A third signed-in user cannot see the job's scope changes.
- [ ] Only assigned tradesperson can propose a change; wrong trade, unassigned trade, or suspended account gets denied by RPC.
- [ ] Proposed extra £12.34 is stored as 1,234 pence; discount £4.50 is -450 pence; reject more than two decimal places and out-of-range values.
- [ ] A second pending proposal is rejected, even when submissions happen simultaneously.
- [ ] Customer views proposal on iPhone and website, approves once, sees recorded reply; repeat approval is rejected.
- [ ] Try declined and withdrawn workflows with separate proposal records; the other party sees in-app notifications.
- [ ] Cancel or complete a job and confirm new proposals/approvals are appropriately rejected.
- [ ] Check that an approved change does **not** silently adjust quotes, invoices, card payments, appointments or certified work.

### FinishProof
- [ ] No handover before job status is `completed`.
- [ ] Assigned trade writes completed-work summary and unchecked/checked factual states, then optionally uploads JPEG, PNG and WebP files below 4MB each.
- [ ] Photo storage rejects unauthorized uploads and refuses paths containing additional folders or invalid extensions.
- [ ] Customer views handover, reads signed photos; unrelated account is denied; signed URLs expire.
- [ ] New handover for same job is rejected; recorded original remains unchanged.
- [ ] Customer requests follow-up with at least 10 characters and trader sees notice.
- [ ] Both participants can send aftercare messages while unrelated accounts are denied.
- [ ] Customer acknowledges receipt, no false 'certified' or 'rights waived' wording, and history persists after sign-out/sign-in.
- [ ] Failed upload / interrupted network leaves an understandable error, preserves user's typed draft, and cleans up orphaned files when possible.

### Cross-platform and presentation
- [ ] iPhone small-screen layout, scrolling while keyboard open, focus stability, photo picker, dark-mode/readability and reduced-motion preferences
- [ ] Website mobile Safari and desktop, deep links, navigation back/forward, loading/empty/error states
- [ ] Both sides receive only correct own-account data, with no public precise GPS, home address or credential files
- [ ] Confirm transaction limits, RLS and `SECURITY DEFINER` functions with Supabase database security advisors
- [ ] Confirm web production deployment is READY and iOS distribution/update has happened before announcing feature live

## Known limits
- ScopeGuard records proposed **price differences** only; no automated job total recalculation, invoice adjustment, payment, deposit, tax/VAT treatment or contract signature.
- FinishProof does not independently verify quality or trade credentials, generate compliance certificates, or settle disputes.
- The current production project contained **zero real standard job records** when this feature was built, therefore live two-account workflow outcomes remain unverified. Do not call these flows launch-proven until the above checks pass.
