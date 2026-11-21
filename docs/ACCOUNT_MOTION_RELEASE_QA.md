# Tradarr account, motion and typography release QA — 21 November 2026

## What changed
- Website: three different, locally hosted font families through Next.js `next/font` — **Manrope** for reading text, **Space Grotesk** for controls/labels/figures, **Fraunces** for editorial headlines. Existing teal, coral and warm-white canvas retained.
- iPhone: compatible platform font pairing for Expo Go without a rebuild: editorial **Georgia**, structured **Avenir Next** (Android system sans), and **Menlo** numeric metrics (Android monospace).
- UI motion: more tangible button press feedback, directional screen entry and account-mode transitions. Motion remains optional for users with Reduced Motion enabled.
- Signup: aligned UK mobile number validation, primary trade metadata, 12–128-character password with a letter and number, resend cooldown, and error recovery if the network fails.
- Registration privacy: `private.handle_new_tradehub_user()` now keeps newly registered traders' private mobile out of the publicly readable `tradesperson_profiles.public_phone`; existing explicitly published numbers are untouched.
- Profile: public business phone is optional, labelled public, and not a requirement for the profile-completion checklist.
- Website open job editing: customer can edit description/postcode and timing/date on a posted, normal job **before any invitation**. The saved values use the `tradarr_customer_edit_uninvited_job` security-invoker RPC. Once invited, job details are locked to prevent silently changing an offered request. Customer can cancel and repost.
- Password recovery: confirmed password plus strength check; no misleading "updated" success before Supabase acknowledges the change.

## Automated verification
- [x] Supabase migrations applied to linked project, versioned in both repos.
- [x] SQL function inspection: `tradarr_customer_edit_uninvited_job` uses SECURITY INVOKER; anonymous EXECUTE rejected; authenticated EXECUTE available and RLS applies.
- [x] Website source syntax/import checks, full production build, existing marketplace/map/admin regressions and new `test:account` and `test:job-edit` pass in GitHub Actions.
- [x] Expo TypeScript check and native CI suite pass.

## Release blockers: must be verified with real accounts/devices
No genuine customer accounts or tradesperson accounts were created as part of development. Tests below are **not** claimed as complete.

### Authentication and account privacy
- [ ] Register a fresh customer on iPhone and another on website, verify email links, and sign in with the same account on both devices.
- [ ] Register a fresh tradesperson; verify trade profile is created with correct primary trade and private account mobile stored only in `profiles.phone`. Sign in as a different customer: public phone is blank until deliberately published.
- [ ] Explicitly publish a public business phone; customer can see it. Remove it; private signup phone remains unchanged.
- [ ] Submit signup while offline or with a network timeout; button recovers and draft stays intact.
- [ ] Send verification twice; resend cooldown prevents accidental repeated emails. Expired link leads to helpful recovery.
- [ ] Reset password using a new verified recovery link, reject mismatched passwords and short/weak credentials, then sign in again.
- [ ] Switch between customer/trader/admin views; role-specific personal details do not leak between public/private profiles.
- [ ] For administrator, verify second factor remains required for privileged actions.
- [ ] Confirm notification preferences, account blocks, deletion request and signed-out state on both platforms.

### Job-edit workflow
- [ ] Post a normal Flexible request without invitations; edit description, postcode and change to Scheduled with future time. Confirm database persists `timing='Scheduled'`, `requested_start` and 2-hour `requested_end`.
- [ ] Edit Scheduled to Flexible; confirm stored requested start/end are cleared, not left as stale appointments.
- [ ] Invite a tradesperson; verify Edit disappears and database rejects a forged/old edit request.
- [ ] Accept the job as tradesperson; verify customer can no longer edit or cancel as if unassigned.
- [ ] A third authenticated user cannot modify another customer's job. No public GPS or private home address is newly exposed.

### Premium feel and accessibility
- [ ] Fonts genuinely load (desktop, mobile Safari, iPhone native), legible fallback when offline; no clipped headings at 320–390px.
- [ ] First launch, customer Home, trader Home, map, inbox, tools and profile: check distinct headline/body/numeric font hierarchy; no missing fonts or oversized labels.
- [ ] Tap and keyboard test: no double-taps, bounced layout, clipped sticky bars, hidden inputs, duplicate transitions or focus loss.
- [ ] With iOS **Reduce Motion** on, ensure content remains immediately visible and no decorative looping animation is forced.
- [ ] Background the app, return to foreground; animations should not churn CPU or create additional watchers.
- [ ] Verify real maps and pins stay responsive: camera focus, merchant selection, clustering and location privacy.
- [ ] Verify slow 3G / offline states and meaningful error feedback on navigation and saves.

## External launch dependencies
- Website: confirm Vercel production deployment SHA, not merely GitHub checks. Test in an actual browser.
- iPhone: merging source does not automatically deliver an Expo Go update or an App Store binary; check the runtime/QR/update channel.
- Remaining broader product verification: two-account chat, real merchant discovery UK-wide, booking/rescheduling, payments and invoice flows, notifications and admin permissions.
- Keep required external credentials and Supabase service-role keys out of public clients.
