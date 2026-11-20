# Tradarr · native iPhone / Android push readiness — 20 November 2026

## Implemented in the repository

- Added the Expo SDK 58-compatible `expo-notifications`, `expo-constants`, and `expo-device` dependencies and the `expo-notifications` config plugin in `app.json`.
- Both Customer and Tradesperson **Inbox → Activity** screens now show a **Phone alerts** panel. It requests permission **only when a user presses Enable phone alerts**. In Expo Go it explains that a native development/production build is required, rather than attempting an unsupported remote registration.
- On a supported physical native build the app obtains a project-scoped Expo token and inserts an owner-only row into Supabase `tradarr_push_devices` after the user grants permission. It checks account-wide `profiles.notifications_enabled` as well as the device registration before showing an enabled state.
- **Disable on this phone** deletes only that user's exact token; it does not disable every device or stop Activity notifications.
- App sign-out now attempts to deregister that device **before** closing the Supabase session. A failed attempt produces a warning because an offline logout cannot guarantee server-side token deletion.
- A native notification tap extracts **only an opaque notification UUID**, checks it against the signed-in user's protected `tradarr_notifications` row, then navigates to an appropriate customer/trader area. A message can open the actual participant-owned conversation, even when it has fallen outside the normal 100-conversation list. An unrelated account cannot use old notification data to navigate to a former account's private records.
- Foreground notification presentation has a handler; tapping a notification received while the app is closed uses Expo's last-response API.
- Added `scripts/test-notification-destinations.cjs` to GitHub CI. It verifies customer/trader routing, malformed conversation IDs, Crew safety and alert categories.
- Supabase send and delayed receipt tracking were already implemented. No new server-wide privilege was granted to register phone tokens; the existing owner-only RLS policies remain in force.

## What is still NOT verified

- **Real APNs push delivery and the iPhone tap flow have NOT been exercised.** An automated TypeScript check is not proof that a notification appears on a real device.
- The current Supabase project had zero enabled Expo push tokens when this work began.
- The new native dependency and plugin require a **new app binary**; an Expo Go reload or JavaScript-only OTA update cannot provide the missing native module.
- An iOS development build requires paid Apple Developer membership and device registration. A production iOS build additionally needs working APNs credentials. Android push requires FCM V1 credentials.
- For sign-out when offline, server-side token revocation is best-effort. Until confirmed, the old account may still send push notifications to the phone; the app warns users.

## Setup when Apple Developer is connected

1. Pull the latest GitHub main branch and run `npm install` followed by `npx expo install --check`. Inspect `app.json` for the notification plugin.
2. Sign in to the project's Expo/EAS account (owner in `app.json`). Keep the existing EAS `projectId` and bundle identifier until store registration is final.
3. Register the iPhone in the Apple Developer portal / via Expo EAS device registration, configure APNs push credentials through EAS, and create the signed **development client** build.
4. Install that native build on the physical iPhone (not Expo Go) and sign into a **test** Tradarr account. Open **Inbox → Activity → Enable phone alerts**, grant iOS permission, and confirm the user has exactly one enabled token for this device in `tradarr_push_devices`.
5. Send an in-app test event with a second test account (message, job invitation, booking change). Verify the private push outbox has a ticket, the delayed Expo receipt is accepted, and the physical device displays the notification. Tapping it must open the correct conversation or job-related screen under the same signed-in account.
6. Disable push on that phone and repeat: no more pushes to its old token. Repeat with account sign-out and with a different account on the same phone to verify the old user's private alerts cannot leak.
7. Test foreground, background, terminated and weak-network behaviour; check notification-disabled profile preference, denied permission and another account's UUID.
8. For Android, configure FCM V1 with EAS and repeat on a genuine Android device.

## Safety notes

- Do not expose APNs, Firebase or Supabase service-role secrets in `EXPO_PUBLIC_*` environment variables or mobile source.
- This feature does **not** need Stripe or a paid Tradarr Pro subscription. Customers stay free and phone alerts are not paywalled.
- Notification body text remains generic and does not reveal private addresses. The signed-in user must fetch full details via Supabase owner/participant checks.
- Reference: https://docs.expo.dev/push-notifications/push-notifications-setup/
