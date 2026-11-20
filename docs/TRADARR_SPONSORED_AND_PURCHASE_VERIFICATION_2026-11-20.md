# Tradarr: sponsored visibility and store verification — implementation report
Date: 20 November 2026. The app is **not ready to charge**.

## Changes now in the codebase and Supabase

**Sponsored visibility.**
- The public map query returns `profile.promoted` only through a narrow, RLS-filtered, service-written projection of real verified boost records. No purchase or store transaction ID is exposed.
- The current `boosts_live=false` control hides every promoted designation, including if an active boost row is created for testing.
- A native customer directory can show at most **two clearly labelled "Promoted nearby · paid placement"** entries. Those entries are excluded from the organic list to prevent duplicates; remaining organic results stay sorted according to the customer's selected nearest/rating/review criterion.
- On the map, eligible sponsored real traders receive a small **Ad** marker. The selected profile preview and DirectoryRow clearly say "Promoted · paid placement." Fictional demos can never be promoted.
- A cancellation/refund revokes the private boost and removes its public marker through a trigger. Expired boosts disappear automatically through the SELECT policy's `ends_at>now()` predicate, without relying on a cleanup cron.
- Merchant map positions, precise live GPS and the existing review/verification display were not changed.

**Payment-processing core.**
- A service-only, transactionally atomic `tradarr_finalize_verified_store_event` function records a provider event and updates trusted membership or boost state. The function cannot be executed by an authenticated app user and refuses all writes until `checkout_live` and `receipt_verifier_ready` are both true.
- A private product allowlist (`tradarr_store_product_catalog`) is deliberately **empty**. It must be filled only with real, store-approved product IDs, verified durations and agreed tier mappings. Product prices are NOT invented.
- The function deduplicates store event IDs, serialises events by account, disregards superseded subscription events, retains paid-through expiry on cancellation, expires/revokes subscriptions, grants time-bound non-renewing boosts and revokes refunded boosts.
- A separate `tradarr_verified_purchase_events` audit ledger tracks the processed events without publishing any receipt details.

**Optional RevenueCat verifier adapter.**
- `supabase/functions/tradarr-store-webhook/index.ts` is deployed. The external endpoint uses `verify_jwt=false` because RevenueCat cannot send a Supabase user JWT, but is protected by **both a private configurable Authorization header and a 5-minute-tolerant HMAC-SHA256 raw-body signature**.
- It requires `REVENUECAT_WEBHOOK_SIGNING_SECRET`, `REVENUECAT_WEBHOOK_AUTHORIZATION`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_ALLOWED_APP_IDS`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server-only environment settings. Without them, it responds with HTTP 503 and **cannot credit a purchase**.
- The webhook accepts only registered Apple or Google store app IDs, the store types APP_STORE / PLAY_STORE, and a real Supabase UUID as the RevenueCat App User ID. Sandbox events are ignored by default.
- Instead of trusting a client or webhook's claimed entitlement, it fetches CURRENT subscriber status through RevenueCat's authenticated server API and checks the purchased product against the private local product allowlist. Verified records are then passed to the service-only finaliser. Invalid, incomplete or unconfirmed data fails closed.
- This adapter is **optional**. The product catalog and finaliser can later be used by a direct Apple/Google verification implementation if we choose not to use RevenueCat.
- The adapter is not configured with RevenueCat credentials, and no Apple/Google purchase has been verified end-to-end. **Do not enable the production billing controls yet.**

## Automated and database tests

- Node.js CI checks the two-sponsored-position cap, organic ordering, demo exclusion and "Promoted" labels.
- The store-webhook CI test covers missing secrets, wrong authorization, tampered signature, replayed timestamps, test events, disabled billing, validated subscription/expiry handoff, invalid user IDs, sandbox events and refund revocation handling using a mocked store provider.
- Tests against Supabase in **rolled-back transactions** verified that grant/revoke sync works, authenticated clients cannot create paid boosts, and signed-in users see no sponsored records while boosts are off.
- Another rollback test exercised atomic membership grant, duplicate event, cancellation with paid-through access, expiration, boost grant and refund. No actual user or business data was retained.
- GitHub CI passing is NOT a production receipt-verification test, a native store purchase, nor proof of real iPhone rendering performance.

## What must happen before any payment is taken

1. Choose whether to use **RevenueCat** or direct Apple/Google billing verification. RevenueCat's published pricing has a free monthly tracked-revenue allowance and percentage pricing once the allowance is exceeded; review current terms before subscribing.
2. Open and configure Apple App Store Connect and Google Play Console accounts (no accounts were created through this work), and register real iOS/Android product identifiers.
3. Approve Tradarr Free/Pro/Business prices, the provisional **3 free new-job acceptances per UTC month**, and boost durations and prices. Ensure the free customer experience stays free and Tradarr takes no commission on jobs.
4. If using RevenueCat, create the correct entitlements (`tradarr_pro`, `tradarr_business` or matching configured IDs), configure both app IDs, obtain its API and signing credentials, configure HMAC webhook signing, and enforce UUID-based customer identity.
5. Implement the matching **native in-app purchase and restore-purchase SDK** in Expo development builds. Expo Go cannot complete actual store transactions.
6. Run Apple sandbox and Google Play internal-test purchases, cancellations, refunds, renewals, billing grace, transfers, account switching, restore on a new phone and edge cases. The webhook currently ignores `TRANSFER` and `PRODUCT_CHANGE` for automatic changes: these must be handled or reconciled before production launch.
7. Reconcile purchased boosts against the actual RevenueCat non-subscription transaction format in sandbox. If the provider's subscriber API does not report a matching transaction ID, the current verifier deliberately refuses to issue a boost.
8. Turn on the verifier-readiness switch only after the service passes external tests. Then enable checkout, then carefully enable free-tier enforcement and boosts, with a production rollback procedure. Never turn all switches on just to test the screen.

## Current production state

- `checkout_live=false`
- `receipt_verifier_ready=false`
- `enforcement_live=false`
- `boosts_live=false`
- Product catalog empty; no store event records or paid boosts created.
- No Expo OTA update or native build was published to the user's iPhone.

Official reference documentation:
- https://docs.expo.dev/guides/in-app-purchases/
- https://www.revenuecat.com/docs/integrations/webhooks
- https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
- https://www.revenuecat.com/pricing
