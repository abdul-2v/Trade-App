# Tradarr Pro · phase 2 staging status (20 November 2026)

## What is now implemented

1. **Free response policy:** `tradarr_billing_controls.free_monthly_accepts=3` is a **provisional launch setting**, not the final published offer. It counts newly accepted normal/flexible and urgent job offers using one atomic, UTC-month counter. Declines and existing accepted-job progress do not consume another acceptance. The database trigger is attached to both `job_offers` and `urgent_request_offers`.
2. **Bypass protection:** once enforcement is enabled, a direct client update to `jobs.status='accepted'` cannot bypass the offer-response guard. The existing trusted offer-response function continues to accept jobs and create conversations. The direct protection does not run in the current development state.
3. **Verified boosts:** private `tradarr_profile_boosts` rows require a provider, product ID, unique verified transaction ID, verification timestamp, bounded start/expiry, and a verified service-role write. There is no self-boost client action.
4. **Pro account dashboard:** `tradarr_my_pro_dashboard()` is RLS-based and reports the user's current tier, expiry, launch status, provisional free allowance, usage (only accumulated after enforcement starts), and active verified boosts when the boost launch switch is on. The tradesperson **Tradarr Pro** screen displays these states and clearly labels proposed versus active restrictions.
5. **Purchase-event ledger:** `tradarr_verified_purchase_events` is service-only and idempotent by provider/event ID. It stores no public receipts, ready for future Apple/Google server verification.
6. **Three independent launch switches:** `receipt_verifier_ready=false`, `checkout_live=false`, `enforcement_live=false`, and `boosts_live=false` on the existing singleton controls. Database constraints forbid checkout/enforcement/boosts when the verifier is not marked ready. No subscription, customer payment or boost purchase is currently available.

## Verification performed against the connected Supabase project

- The default fake authenticated user's dashboard returned Free, 0 acceptances used, a *proposed* limit of 3, no boost, and no live billing/enforcement.
- The trigger acceptance logic was exercised in a **transaction that was rolled back**: three acceptances were admitted, and the fourth was rejected.
- A second rollback test mixed normal and urgent offers: the same counter was consumed across both job types and the fourth acceptance was rejected.
- An authenticated direct job-acceptance attempt was rejected while enforcement was temporarily enabled inside a rollback test.
- A transaction temporarily attempted to enable checkout without verified readiness and attempted to insert a duplicate store event: both were rejected and rolled back.
- Permission checks showed signed-in clients cannot create boosts, change usage, change the billing switch or read provider receipts.
- GitHub Actions checks syntax, TypeScript, Expo dependency compatibility, UX wiring and marketplace tests.

**No real trader job, purchase, account or payment was changed by these rollback tests.**

## Still outstanding (must not activate until done)

- Final Free response allowance, precise Pro pricing, Business tier and boost product durations/prices must be explicitly approved.
- Store products and credentials must be configured in **App Store Connect** and **Google Play Console**.
- An actual native IAP implementation and **server-side Apple/Google purchase verification** (or a deliberately selected third-party verifier), entitlement writes and transaction notification verification are still absent.
- Implement refund/revocation, trial, grace period, price changes, restore purchases, account deletion and renewal test journeys. Ensure StoreKit/Play Billing satisfy current marketplace policies.
- Map boosts are not yet integrated into customer ranking. When introduced, sponsored placement must be clearly labelled and limited so relevance, real reviews, and proximity cannot be misrepresented.
- Run multi-account device acceptance tests, a review of all gating enforcement paths, load/concurrency tests, and a production rollback plan.

## Launch conditions

Only after external store products, receipt verification, security review and sandbox purchases work:

1. Mark the receipt verifier as ready **from trusted administration only**.
2. Turn on checkout, test against real sandbox purchases and renewals.
3. Validate customer accounts are free, Pro access is server-verified, and no existing booking is interrupted.
4. Enable free-tier enforcement and boosts in a controlled beta with logging and a quick rollback switch.

Do **not** switch any launch flags to true just to view the Pro screen.
