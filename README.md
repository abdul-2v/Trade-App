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
npm run typecheck
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

The older `supabase/schema.sql` is a **historical prototype**, not a complete representation of the current database. Do not use it as a replacement for the live schema without reconciling the migrations.

## Known launch blockers

1. End-to-end testing using two genuine customer/tradesperson accounts and two devices.
2. Verify normal/urgent/flexible request acceptance, progress, cancellation, messaging, review and error states.
3. Live push notifications when the application is closed.
4. Completed credential checks and honest verification badges.
5. Real calendar scheduling, route optimisation and price/saving calculations for On My Way and Street Run.
6. Password-reset/deep-link flow, support operations and account deletion.
7. Supabase Auth leaked-password protection setting remains disabled pending project configuration.
8. App Store / Play Store production builds, privacy notices, policies, safety and merchant-data reliability.
9. Test customer map location fallback, supplier finder outside Leicester and GPS privacy on-device.
10. Review automated typecheck and Expo preview statuses before any public distribution.

See `RELEASE_TEST_PLAN.md` for a structured pilot verification checklist.

## Safety and operational notes

The support table is an early-access queue; it does not create an automatically monitored support channel. Do not promise response times or use it for emergency reports without staffing and operational processes.

Precise job and tradesperson GPS must remain accessible only to authorised participants. Public marketplace pins should use softened location data. Never treat an approximate position as a guaranteed arrival ETA.

No in-app payments / Stripe checkout are currently integrated. Prices and savings must be agreed with the provider until verified pricing and payment systems are implemented.
