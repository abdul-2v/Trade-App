# Tradarr — App Store and public launch submission pack (working draft)

Status: **PREPARED, NOT SUBMITTED.** The app source is at version 0.3.0, bundle ID `com.tradehub.app` and Expo/EAS project `554f9986-4268-42dd-920a-86f765cef9e4`. Do not rename the bundle identifier without confirming existing Apple/Google registration.

## App listing copy (review before submission)

**Name:** Tradarr

**Subtitle:** Find trades. Manage work.

**Short promotional text:** Find local tradespeople, organise enquiries and appointments, and keep job conversations together. Trade availability varies by area.

**Description (draft):**

Tradarr helps people and trade businesses manage local work in one place.

**For customers**
- Look for tradespeople by area and trade.
- Describe the work you need and send a request.
- Keep conversations, appointment requests and job updates organised.
- Review quotes and issued invoices linked to your jobs.
- Leave a review after a completed job.

**For tradespeople**
- Set up a business profile and choose a published work area.
- Receive relevant job enquiries and manage availability.
- Agree bookings, schedule work and organise your diary.
- Prepare quotes and invoices, and keep job information together.
- Find relevant local suppliers and explore flexible On My Way or Street Run enquiries where available.

A request is not a confirmed appointment. Any proposed price and work scope should be agreed between the customer and tradesperson. Tradarr does not guarantee trade availability, qualifications, workmanship, exact journey times or discounts.

**Proposed keywords (verify App Store limit):** tradespeople,plumber,electrician,builder,local jobs,bookings,trade business

**Support URL candidate:** https://trade-website-six.vercel.app/contact — verify in a real browser.
**Privacy policy URL:** **NOT READY** — a final, publicly accessible policy must be published and checked before submission.
**Marketing URL:** https://trade-website-six.vercel.app — verify the live site.

## Data and privacy declaration inventory — must verify with business owner

The repository implements or prepares processing for:
- **Identity/account data:** email, name, account role, hashed credentials managed by Supabase Auth, private signup telephone, password recovery events.
- **Business profile:** selected trade, public display name, optional business telephone and description, chosen work postcode/area, voluntary profile/portfolio photographs, private credential evidence and verification decisions.
- **Location:** optional device GPS for map use or time-limited work availability, approximate published work areas and private property locations for authorised job participants. External Google Maps directions are launched by explicit user action.
- **Marketplace records:** job requests, offers, appointments, messages and shared files, quotes, issued invoices, reviews, safety reports, blocking, support cases and deletion requests.
- **Technical messaging:** notification preferences, Expo push tokens if enabled on a compatible native device, message/notification delivery metadata and service diagnostic logs.
- **Potential payments:** invoices are trade-issued/self-reported; in-app Pro checkout is currently disabled. Update disclosures before enabling native purchases.

Check actual SDKs, diagnostics, retention, sharing, lawful bases, cross-border processing and third-party agreements. Do **not** answer App Store privacy questions by guessing. The controller's legal identity, contact details, lawful bases, retention schedule and rights-handling process are still required.

## App Review / real-device gates

- [ ] Establish Apple Developer membership, certificates, provisioning, APNs and App Store Connect access.
- [ ] Confirm final product name, ownership, bundle ID and target countries before the first upload.
- [ ] Publish an approved policy at a stable public HTTPS URL and complete App Privacy labels accurately.
- [ ] Publish/review UK-appropriate terms and clear business contact and privacy rights information.
- [ ] Check in-app account-deletion **request and completion** procedures against Apple's rules; a request is implemented, but legal retention and actual successful completion are not yet tested.
- [ ] Complete actual account-creation, verification, recovery, sign-out and cross-platform account tests.
- [ ] Run the end-to-end customer/tradesperson booking, message, quote, invoice, review, safety report and cancellation scenarios on separate accounts.
- [ ] Verify merchant maps, location permission/denial, no public private GPS, accessibility and small iPhone layouts.
- [ ] Install a signed development/preview build. Expo Go is insufficient to prove remote push; configure APNs and test deliveries.
- [ ] Capture accurate iPhone screenshots from a real installed version, including screens without fake available traders.
- [ ] Set up an owner-managed safety/support inbox and incident process, with monitoring and backups.
- [ ] Review remaining privileged SQL RPCs for participant permission; run `supabase/tests/tradarr_launch_security_read_only.sql`.
- [ ] Enable Supabase Auth leaked-password protection if supported by the selected plan/configuration, then re-check the security advisor.
- [ ] Leave Tradarr Pro payment enforcement disabled until a separately tested subscription/receipt-validation flow is approved.
- [ ] Submit production IPA and review after internal testing; source-code merges alone are not App Store binaries.

## Current technical release constraint

Expo's free CI/CD quota was reported exhausted on 21 November, and automated preview EAS delivery is disabled. The GitHub TypeScript/logic checks do **not** install an iPhone binary. A single deliberate EAS workflow must run once access, quota and credentials are ready.

## Official current reference points

- Apple Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy / required policy URL: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- In-app account deletion: https://developer.apple.com/go/?id=ar-ad-support
- Native Expo build checklist: `docs/IOS_PREVIEW_RELEASE_RUNBOOK_2026-11-21.md`

These notes are product/technical drafts, **not legal advice or published policies**. Require legal/business-owner review before exposing terms or submitting to Apple.
