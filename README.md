# TradeHub — local trades marketplace

TradeHub is a React Native / Expo application using Supabase for authentication, profiles, jobs, messages, reviews and realtime updates. The codebase has both customer and tradesperson experiences.

**Status:** Active development / controlled testing. Not ready for public App Store release.

## Available in the codebase

- Email/password registration and email-link verification.
- Customer and tradesperson account modes.
- Customer trade discovery, profile browsing, map and saved-professional bookmarks.
- Normal, urgent and flexible job-request flows backed by Supabase.
- Tradesperson availability, work radius, work-area / live-location modes and job dashboard.
- Realtime job updates and chat implementation.
- Completed-job review UI and database structures.
- Tradesperson merchant finder: tradespecific shops, Leicester fallback directory, map pins, GPS and external directions.
- Owner-only support requests available from customer Account > Help & support.
- Design system with ink/navy, warm stone, slate and terracotta.

**Important:** The app must never present sample profiles, fabricated discounts, route slots or sample earnings as real. The customer map shows real profiles by default, with a separate explicitly labelled demo preview. A flexible job request is not a confirmed appointment or price.

## Run and validate

```sh
npm install
npm run check:syntax
npm run typecheck
npx expo install --check
npx expo start --tunnel
```

On a real phone, verify all account, map and booking paths. A GitHub Actions workflow runs `npm run typecheck` on code changes. Expo preview publishing is a separate workflow and can succeed even when its compatibility check requires attention.

## Supabase

Environment variables are documented in `.env.example`. Use only public/publishable keys inside the app; keep all secret/service-role keys on trusted servers.

Current database migrations are in `supabase/migrations/`, including:

- Foreign-key lookup indexes for jobs and locations.
- Saved tradespeople with owner-only access.
- Owner-only support tickets.
- Public map-presence rules hiding offline/stale live coordinates.
- Least-privilege grants for real messaging, profiles and tradesperson availability. This corrects missing INSERT/UPDATE permissions while leaving verification badges and review scores protected.

The older `supabase/schema.sql` is a **historical prototype**, not a complete representation of the current database. Do not use it as a replacement for the live schema without reconciling the migrations.

## Known launch blockers

1. End-to-end testing using two genuine customer/tradesperson accounts and two devices.
2. Verify normal/urgent/flexible request acceptance, progress, cancellation, messaging, review and error states.
3. Live push notifications when the application is closed.
4. Completed credential checks and honest verification badges.
5. Real calendar scheduling, route optimisation and price/saving calculations for On My Way and Street Run.
6. Password recovery screen exists (email code or copied link), but needs a real-device email test and production deep-link setup; support operations and account deletion are still missing.
7. Supabase Auth leaked-password protection setting remains disabled pending project configuration.
8. App Store / Play Store production builds, privacy notices, policies, safety and merchant-data reliability.
9. Test customer map location fallback, supplier finder outside Leicester and GPS privacy on-device.
10. Review automated typecheck and Expo preview statuses before any public distribution.

See `RELEASE_TEST_PLAN.md` for a structured pilot verification checklist.

## Safety and operational notes

The support table is an early-access queue; it does not create an automatically monitored support channel. Do not promise response times or use it for emergency reports without staffing and operational processes.

Precise job and tradesperson GPS must remain accessible only to authorised participants. Public marketplace pins should use softened location data. Never treat an approximate position as a guaranteed arrival ETA.

No in-app payments / Stripe checkout are currently integrated. Prices and savings must be agreed with the provider until verified pricing and payment systems are implemented.

## Password recovery during Expo Go testing

The sign-in page now has **Forgot your password?**. The reset screen sends a recovery email through Supabase Auth. In Expo Go, copy the *link address* from that email (without opening it) and paste it into the app; alternatively enter a six-digit recovery code if the email template contains one. Once verified, set a new password. The latest recovery link is single-use and expires.

A seamless tap-from-email link requires a native URL scheme, an allowed redirect URL in Supabase Auth, and a development/production build. This isn't implemented for Expo Go yet.

## Build diagnostics

The GitHub Actions workflow now performs syntax parsing, Expo package compatibility checking, and the full TypeScript check. The separate Expo automatic-preview native compatibility job still reports an error; its detailed logs must be inspected in the owner's Expo dashboard before marking builds healthy.
