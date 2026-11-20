# Tradarr Pro — native purchasing and boosts
**Work completed 20 November 2026. Billing is OFF.**

## Implemented
- Installed pinned `react-native-purchases@9.6.6` and `expo-dev-client@~58.0.21`; Expo SDK 58 dev-client profile already exists in `eas.json`.
- Added separate PUBLIC platform keys in `.env.example`:
  - `EXPO_PUBLIC_RC_IOS_KEY` for RevenueCat iOS public SDK key (`appl_...`)
  - `EXPO_PUBLIC_RC_ANDROID_KEY` for RevenueCat Google public SDK key (`goog_...`)
  These are public *SDK* keys. Never put private RevenueCat API credentials, Apple server keys or Supabase service keys in EXPO_PUBLIC variables or Git.
- `lib/storePurchases.ts` requires an authenticated Supabase UUID, binds the RevenueCat identity to that exact account, loads approved Apple/Google product prices from the store and denies checkout when `tradarr_billing_controls.checkout_live=false`.
- Pro screen renders **real store offerings** and an active purchase button only after backend launch gates are enabled, the native development/store build is present, keys are configured and the product identifier appears in the server-approved catalog.
- `Restore Purchases` is supported for native store builds, separately from selling new subscriptions. RevenueCat local CustomerInfo never directly updates membership; server-verified webhook/finalizer determines actual tier.
- Fixed-duration boosts can be purchased as verified one-time products **only when** `boosts_live=true` and the product is in the RLS-protected approved store catalog. Price and duration come from the store and catalog respectively. There are currently zero approved real products.
- Both purchase flows display a pending-verification message, without prematurely promising active access.
- Catalog is RLS-restricted, client read-only and only reveals enabled approved product identifiers and product types; no private store credentials, transaction IDs or internal provider events are readable.
- RevenueCat webhook, signature verification and atomic backend finalizer were added previously, but are **not connected to real stores**.
- GitHub CI now runs native purchase security tests, including server switch denied, no direct client tier grant, price from store, restore and account separation.
- Ran safe rollback tests: when launch switches are off, approved boost products are invisible. With switches temporarily enabled in a transaction, signed-in traders can read the allowed product but cannot change the catalog. A fake normal account was rejected by protected admin read/write RPCs. The transaction was rolled back.

## Still necessary before real money
1. Agree the actual Free acceptance limit (currently only a proposed **3 per UTC month**), Pro and Business prices, boost durations/prices and StoreKit/Play billing terms.
2. Set up Apple Developer / App Store Connect and Google Play Console. Create true matching subscription and **non-renewing** boost product IDs and RevenueCat entitlements/offerings.
3. Choose and configure RevenueCat. Use separate public iOS/Android SDK keys in the app; put *private* `REVENUECAT_WEBHOOK_SIGNING_SECRET`, `REVENUECAT_WEBHOOK_AUTHORIZATION`, `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_ALLOWED_APP_IDS` only in Supabase Edge Function secrets. These secrets are **not configured**.
4. Add the same approved products to the private `tradarr_store_product_catalog`, initially `enabled=false`, then enable only products that pass sandbox checks.
5. Create fresh signed EAS development builds. Expo Go can show the informational screen, but cannot process native store purchases.
6. Run actual Apple sandbox and Google Play license-tester flows: initial purchase, renewal, cancellation, expiration, restore on a second device, refund/revocation, subscription transfer, offline behaviour, wrong-account restore and one-time boost purchase/refund.
7. Review and finish webhook edge cases. The current webhook deliberately does **not** automatically apply RevenueCat `TRANSFER` and `PRODUCT_CHANGE` events; these need reconciliation before production use. Confirm non-renewing boost history and product type with real RevenueCat data.
8. Only after real store verification is passing, enable the backend `receipt_verifier_ready` switch, then `checkout_live`, then controlled `enforcement_live` and `boosts_live`. Keep a rollback runbook.
9. Test actual real-device UI, screen sizes, platform purchasing dialogs, subscription management accessibility, expired products, and onboarding.

## Security remaining
- Supabase advisors still report SECURITY DEFINER RPCs for privileged admin tasks. Selected admin functions were verified to require staff plus MFA. Do NOT revoke all of them blindly; the admin UI depends on those RPCs. Audit each individually before final release.
- The advisor still reports Supabase Auth leaked-password protection disabled. This is configured under **Supabase Dashboard → Authentication → Sign In / Providers → Email** if the project plan includes that feature, not via SQL. Check the project entitlement and enable it manually.
- Some tables intentionally have RLS with *no* client policies (service-role-only transaction/event/outbox tables). These informational warnings are deliberate; adding a broad public policy would create a vulnerability.
- Account deletion, iPhone/TOTP admin tests, store products, push delivery and full end-to-end booking testing remain release blockers.

## Verification notes
- Static TypeScript / Expo dependency / UX checks, store mocked tests and database rollback tests do **not** confirm that a real App Store or Google Play purchase will complete.
- All checkout and paywall switches remain OFF, no paid records were created, no new app build has been installed on the owner's iPhone.
- Official RevenueCat Expo setup: https://www.revenuecat.com/docs/getting-started/installation/expo
- Official RevenueCat webhooks: https://www.revenuecat.com/docs/integrations/webhooks
- Supabase leaked-password guidance: https://supabase.com/docs/guides/auth/password-security
