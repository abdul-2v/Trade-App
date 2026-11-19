# Tradarr — app-wide quality audit (19 November 2026)

This audit is based on the current GitHub source, the reported iPhone screenshots, the existing GitHub Actions TypeScript/logic workflows and the added TSX interaction audit. It is **not** an iPhone/Android end-to-end test. Do not certify every feature as production-ready solely from a green build.

## Source-wide coverage

Reviewed the route and component inventory in `App.tsx` plus the dedicated customer, tradesperson, Crew, Inbox, Trust, Support and Admin TSX modules. The new `npm run check:ux` checks all TSX files for pressable controls without an action (or an explicit disabled state) and for empty onPress handlers. CI now runs it together with TSX parsing, Expo version checks, TypeScript and marketplace logic checks.

### Implemented in this quality pass

| Area | Confirmed change |
|---|---|
| App crash recovery | A last-resort Error Boundary provides a meaningful explanation and full view restart if rendering fails, instead of a blank page. Async/API errors still require local handling. |
| Customer Rescue | Uses source+ID for selection; shows retry on failed data reads; offers a real new-request route when no old jobs exist. |
| Customer book | Fails visibly with Retry rather than pretending contacts are empty. Separately warns when history queries fail. Validates name, phone and email; catches save/delete failures. |
| Customer OneJob | Shows failed-load retry and catches rejected project-stage updates, preventing a permanently spinning save state. |
| Customer Price Lens | Shows a useful retry state instead of falsely reporting no quotes on a failed backend query. |
| Notifications | Shows a failed-load retry, not a false empty inbox. Marks notifications read locally only after the database confirms the update. |
| Working hours | Clearly distinguishes unsaved edits, ignores the start/end time on closed days, offers a Mon–Fri preset and confirms all seven saved rows. Does not save default values over a known failed data read. |
| Business Suite | Handles failed data requests without rendering fake empty screens; Radar explains empty filters and supports reset; more useful empty cards, assistant record-based suggestions, contact-card preview, starter messages and business KPIs. No false generative AI claims. |
| Keyboard avoidance | Added the documented iOS ScrollView automatic keyboard insets to important quote, invoice, diary, customer, project, rescue-adjacent and business-form screens. |
| Dead controls | Removed unused sample cards with a nonworking View pressable; replaced a nonfunctional “Payments & payouts” row with a real job-costs destination. |
| Prevent regressions | Added AST-based `scripts/check-ux.cjs`, plus a GitHub Actions job step. |

## Existing useful capabilities (not rewritten in this pass)

- Customer: discover/map, job requests, urgent help, booking, quotes/invoices, messages, Home Passport, OneJob, FirstFix, Price Lens, Collective, Grid, Rescue.
- Tradesperson: Home/availability, matched jobs, map/suppliers, Inbox, quoting, invoicing, customer book, working hours/diary, route planning, business suite, Crew, trust and evidence.
- Administration: gated admin console, audit/analytics, moderation, safety and role controls.
- Role switching: keep customer and professional views available to the appropriately authorised account.

## Important outstanding readiness limits

- **Real-device QA:** no automatic tool here has tapped the iPhone app or taken navigation screenshots at multiple device sizes. Test 320/375/390/430-point widths, large accessibility text, orientation, light/dark if offered, keyboard, foreground/background, offline/reconnect, slow 3G and account switching.
- **Marketplace liquidity:** demo suppliers/tradespeople are deliberately labelled examples and should not be mixed up with real capacity. The owner previously asked for temporary fake tradespeople in test mode; do not silently remove them without revisiting that decision before release.
- **Advanced AI:** the Business Assistant currently makes deterministic recommendations from authorised saved data; a secure server-side generative AI integration is not yet active.
- **Business booking URL:** the booking contact card is shareable but a hosted public business website is not live.
- **Push delivery:** production push capability needs real-device/EAS/Apple/Google verification, not only in-app notifications.
- **Payments:** no paid Tradarr Pro subscription/payout system has been added. Manual invoice status is not proof of bank payment.
- **Supabase advisors:** security advisors flag enabled RLS without policies for an internal push-outbox table, 14 callable SECURITY DEFINER RPCs requiring individual authorisation review, and leaked-password protection not enabled. Avoid blindly revoking RPC privileges without testing admin and Crew. Performance advisors also report unindexed foreign keys, duplicate/unused indexes and multiple permissive policies.
- **Code organisation:** `App.tsx` is still a large monolith. A future modularisation with screen-level automated UI tests would make systematic maintenance safer; avoid an untested all-at-once rewrite.

## Release-quality manual smoke matrix

| Section | Must test |
|---|---|
| Sign up / login | Customer, tradesperson, Crew, password reset, session restore, expired token, logout, admin mode switching |
| Customer Home / Discover | All quick actions, location and postcode choice, real-vs-demo labels, empty search, loading/error/retry |
| Customer map | GPS denied, saved work area, clustered markers, supplier selection and re-centring, navigation directions |
| Requests / booking | Post a job, urgent help, accept/decline, reschedule and cancel, no duplicate bookings |
| Quotes / invoices | Create, edit, issue, PDF, VAT/cost calculations, customer receipt, status transitions, download after downgrade |
| Messaging / Inbox | Two-account threads, attachments, receipts, blocking/reporting, notifications and deep links |
| Customer toolkit | Home Passport, FirstFix, OneJob, Rescue, Price Lens, Collective, Grid — empty, form, saved, error and refresh states |
| Tradesperson Home | Online/offline persisted across tabs and app restart, map location privacy, offers and job actions |
| Tradesperson Tools | All 12 suite sections; save/reopen records; no action without confirmation; keyboard never hides active input |
| Profile and trust | Photo, completion checklist, public preview, service area, hours, private evidence and verification review |
| Crew | Worker-only account, helper advert, applications, acceptance, private messaging, expiry, account blocking |
| Admin | MFA, separate customer/trader view, role restrictions, audit trail, analytics, moderation and appeals |

### QA exit gate

Require green syntax, UX, Expo-version, TypeScript and logic checks on the exact merged commit. Then manually perform the routes above on at least one current iPhone and one Android handset (or emulator for preliminary visual checks), including slow/offline and second-account cases. Log screenshots and failures. **Do not advertise that the whole app is verified bug-free until that device work is complete.**
