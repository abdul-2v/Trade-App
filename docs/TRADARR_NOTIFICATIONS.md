# Tradarr notification infrastructure (18 November 2026)

## Current status

- **Receipt follow-up implemented (20 Nov):** the existing five-minute dispatcher now also checks provider receipts; received errors and unresolved entries are recorded. No Expo tokens were registered during this change.
- **Supabase implemented:** In-app notification database, Expo device-token registry, event-to-notification triggers, private delivery outbox, retry-safe claim RPC, and a deployed Deno Edge Function named `tradarr-push-dispatch`.
- **Automatic dispatch implemented:** `pg_net` trigger wakes the Edge Function on new queue rows; a `pg_cron` job named `tradarr-push-retry-5min` retries transient delivery failures and stalled claims.
- **In-app inbox implemented:** Both Customer and Tradesperson now have a bottom-navigation **Inbox** section with two segmented tabs: **Messages** and **Activity**. Alerts refresh through Realtime, can be marked read and show unread counts; message alerts can open the relevant conversation.
- **Not yet active on iPhone:** Tradarr has no registered Expo push tokens and no Apple APNs credentials. Remote iPhone delivery requires an Apple Developer membership and an iOS development build. Expo Go does not support remote push in SDK 58.

## Verified

Supabase Edge Function `tradarr-push-dispatch` is ACTIVE with gateway JWT verification enabled. An authenticated database-originated smoke request returned HTTP 200 and `{"claimed":0,"sent":0,"skipped":0,"retry":0,"failed":0}` before any real devices were registered. Database policies and the automatic five-minute retry job were verified. The in-app code is subject to CI TypeScript, Expo and syntax checks; a successful CI build is not a real-device notification test.

## Database contracts

- `public.tradarr_notifications`: recipient-owned alerts and read state, with unique `(recipient_id,event_key)` to avoid duplicate inbox rows. Notification bodies contain no exact addresses or raw message content.
- `public.tradarr_push_devices`: each account's private Expo token(s). RLS prevents cross-user inspection and modification. Tokens should be registered from an iOS development build after the user grants notification permission.
- `public.tradarr_push_outbox`: private, service-role-only delivery queue. No authenticated client may forge a push request.
- `public.tradarr_claim_push_batch`: only executable by the trusted service role. Atomic `FOR UPDATE SKIP LOCKED` processing and retry delays prevent double claims.
- `trade_private.tradarr_emit_notification`: database-originated alerts from messages, job offers, accepted offers, booking changes, created appointments and relevant job-status changes.
- `trade_private.tradarr_dispatch_push_http`: retrieves the existing public anon JWT from encrypted Supabase Vault and asks the JWT-verified Edge Function to deliver *only pending server-generated notifications*. It never trusts user-submitted payloads.
- `supabase/functions/tradarr-push-dispatch/index.ts`: server sender using the automatically available `SUPABASE_SERVICE_ROLE_KEY`. It checks the recipient's `profiles.notifications_enabled` preference, skips read alerts/no devices, sends via Expo's API, handles `DeviceNotRegistered` ticket errors and stores push ticket details. It never exposes a service role key to the app.

**Secret handling:** The existing legacy public anon JWT is stored in Supabase Vault under `tradarr_push_anon_jwt`; its value is intentionally *not* committed to GitHub. The Edge Function can use an optional `EXPO_ACCESS_TOKEN` environment variable if Expo enhanced push security is enabled later. Do not enable enhanced security until that token is securely configured in the Supabase dashboard.

## Inbox, appointment and attachment improvements (18 Nov 2026)

- The Activity tab now receives quote deliveries/decisions and provider-side cancellation and confirmation notifications, in addition to the original alerts. Quote notifications lead to the Quote Centre or tradesperson Quotes tool.
- The server creates deduplicated reminders approximately 24 hours and one hour before confirmed marketplace appointments using `tradarr-booking-reminders-5min`. They enter the same private notification + push outbox as all other events. No personal addresses or raw chat content are included in notification bodies. The same reminder schedule also alerts tradespeople about their own scheduled private diary entries; no private customer data is included.
- Conversations can now share private JPEG/PNG/WebP photos, PDFs and Word DOCX files up to 8 MB in `tradarr-chat`, using time-limited signed view URLs and participant-only Storage policies.
- The sender's typing indicator is stored in `conversation_typing` with short expiries, participant-only policies and Realtime refresh.
- Job-linked chat cards show reservation state, shared appointment times, and controls to propose or review rescheduling. This does not bypass the existing conflict checks or mutual agreement.
- Repo contains `expo-document-picker` and `expo-file-system` as SDK 58 dependencies; these are native dependencies, so rebuild/restart the development client after installation.
- GitHub TypeScript CI passed after the app wiring, but no physical-device send/download/booking test has yet been signed off.

## Future iPhone activation — not required now

1. Join the paid Apple Developer Program and confirm the final iOS bundle identifier (`com.tradehub.app` in the current app config; do not change it casually).
2. Generate or connect APNs credentials through Expo/EAS and build a real iOS development version of Tradarr.
3. Install `expo-notifications` and `expo-constants` through `npx expo install`; add the native notifications config plugin and the correct versioned dependencies. Request permission **after an explicit user action**. Obtain the Expo token with the existing EAS project ID and upsert into `tradarr_push_devices` under the authenticated user.
4. On sign-out or revocation, deregister/disable the device token. In-app notifications remain accessible independently of push settings.
5. Connect notification-tap handling so the correct job or chat can open from a native notification. In-app alerts already route to the appropriate area; exact deep-link selection can be refined when native push is activated.
6. Test foreground/background/terminated state on a real iPhone, and inspect Expo tickets plus delayed receipts. Ticket acceptance does not guarantee APNs delivery.

## Still to refine before a public launch

- **Delayed Expo receipts now implemented (20 Nov):** the dispatch function polls Expo's receipts endpoint for accepted tickets after 15 minutes, records APNs/FCM provider acceptance or error, disables `DeviceNotRegistered` tokens, and uses a private retry-limited database claim to avoid competing workers. The first device send/receipt still cannot be verified until native tokens and credentials exist. Successful provider receipt does not prove an iPhone displayed an alert.
- Stronger per-device management, cleanup, account-switching behaviour and push preference categories.
- Monitoring and moderation for high-volume sends. The current service uses generic privacy-preserving push message bodies.
- Real-device testing, Apple credentials and release/build configuration.

## References

- Expo Push Notifications setup: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Expo server API: https://docs.expo.dev/push-notifications/sending-notifications/
- Supabase Edge Function notification guide: https://supabase.com/docs/guides/functions/examples/push-notifications
- Supabase pg_net: https://supabase.com/docs/guides/database/extensions/pg_net
- Supabase Cron: https://supabase.com/docs/guides/cron/quickstart
