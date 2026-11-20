# Tradarr release work · 20 November 2026

## Work committed

**Tradarr Pro (foundation, NOT monetisation live)**
- Read-only subscription screen at Tradesperson Profile and Tools.
- `tradarr_memberships`: service-writable membership status and expiry; owner-readable.
- `tradarr_membership_provider_records`: service-only subscription identifiers and verification metadata; clients cannot read or edit.
- `tradarr_billing_controls`: both `checkout_live` and `enforcement_live` are explicitly **false**, plus a database constraint preventing enforcement unless checkout is enabled.
- `tradarr_my_pro_status()` reads only the signed-in user's membership and public launch-state flags under caller RLS. Verified default: free, inactive, no Pro access, checkout disabled, enforcement disabled.
- No purchase API, no receipt verifier, no signed App Store / Play purchase callbacks and no paywall are active. Do NOT claim users have been charged or paid features are enforced.
- Proposed free restrictions (limited new-job enquiries/applications) are **not yet a committed pricing/allowance policy**. Finalise quotas and ensure existing accepted jobs, customer safety, reviews, and support remain accessible.

**Notifications (server/in-app improved)**
- `tradarr-push-dispatch` v2 is deployed. It keeps the existing protected send process and now checks Expo provider receipts for accepted tickets starting 15 minutes after processing.
- `tradarr_claim_push_receipts` service-only, limited to 10 rows per invocation, plus 10-minute check spacing and four attempts. Results and errors are stored; expired device tokens are disabled.
- The Inbox Activity screen now loads 50 notifications at a time with a real **Load older activity** action, exact unread totals and a retry state without destroying the last loaded list.
- Critical limitation: **no registered Expo push tokens**, no iOS/APNs credential and no verified native notification delivery. A successful Expo receipt only means APNs/FCM accepted the notification, not that an actual iPhone displayed it.
- The previous five-minute scheduled dispatch wakes the same Edge Function, so it also performs queued receipt checks.

**Quality and performance**
- Customer view switch wording now clearly says **Open tradesperson view**, not `Open Tradarr Pro` (the latter now means the optional subscription).
- Customer notification settings explicitly distinguish remote pushes from in-app Activity.
- Removed an exact duplicate unique invoice index; retained the remaining unique index. Added indexes for common chat typing and Crew-message foreign-key lookups.
- Reviewed code for obvious inert/placeholder controls in the main customer, trader, Crew, admin and messaging screens. This cannot substitute for touching the actual app on iPhone.
- TypeScript, syntax, UI control and marketplace logic CI checks are required before accepting this work.

## Required before turning on paid restrictions

1. Agree final pricing and free job-response quota; confirm which profile and business-management tools remain free.
2. Create Apple App Store Connect and Google Play Billing product identifiers; configure Apple / Google subscriptions and, if sold in the app, profile boosts.
3. Build actual native store purchasing, verified server-side subscription event processing, restore purchases, grace periods and cancellation behaviour.
4. Test sandbox purchase, renewal, expired subscription, refund, device migration, offline login and user deletion.
5. Enforce paid restrictions **at the database/server action layer**, not only by hiding buttons. Keep customer accounts free; do not charge job commissions.
6. Only then enable checkout and enforce restrictions with an explicit release switch.

## Required before native push is considered working

- Apple Developer membership / APNs credentials and an EAS development build with `expo-notifications`, not Expo Go.
- User-initiated permission request, Expo token registration, push-token logout cleanup, foreground/terminated action navigation, receipt inspection and notification preference validation.
- Tests on two distinct accounts with an actual iPhone. Current server receipt handling is deployed but untested with live messages.

## Other launch blockers unchanged

- Configure the private Google Routes API key and billing/quota settings for traffic-aware journey previews.
- Physical iPhone map/cluster, merchant selection, journey and administrator testing.
- Account safety/moderation test scripts with disposable accounts; end-to-end booking with two genuine accounts.
- Privacy/terms/store listing, production build, customer support and monitoring arrangements.

No claim of App Store readiness is made from GitHub CI alone.
