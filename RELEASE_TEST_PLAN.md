# Tradarr release test plan

**Environment:** staging/test accounts only; do not send real customers to demo profiles.
**Tester:** one customer, one real tradesperson, two physical phones, Supabase dashboard for records and GitHub Actions / Expo for build status.

## A. Build and authentication
- [ ] Latest GitHub Actions TypeScript check completed successfully
- [ ] Expo native compatibility is clean, and latest OTA update is visible on phone
- [ ] New customer can register, verify email, sign in, sign out and sign back in
- [ ] New tradesperson can register, select trade, verify email, and publish business profile
- [ ] Correct role is restored after force-closing / restarting the app
- [ ] Forgot password email request works with a registered test account
- [ ] Latest recovery link or six-digit code is accepted and new password works after sign-out
- [ ] Old password is rejected after reset; expired/used links show clear errors
- [ ] Account deletion and native deep links remain incomplete until implemented and tested

## B. Customer discovers a real tradesperson
- [ ] With no real map presence, customer sees honest empty state, not fictional available professionals
- [ ] Preview demo requires deliberate opt-in and is clearly labelled
- [ ] With real map presence, customer sees the genuine profile with correct trade
- [ ] Available/offline states reflect the Supabase availability records
- [ ] Denying GPS labels fallback distances correctly and never claims they are from device
- [ ] Search, map pins, filters and List view work
- [ ] Save a genuine professional, reopen their profile, un-save it
- [ ] Account > Saved tradespeople shows the persisted list after re-login
- [ ] Demo profiles cannot be saved or phoned

## C. Normal job journey
- [ ] Customer can send a genuine booking request from a real profile
- [ ] An offer appears in only the intended tradesperson's Jobs screen
- [ ] Tradesperson accepts or declines; customer sees correct status
- [ ] Two attempted accepts cannot assign a job to two tradespeople
- [ ] Both sides can message each other and see their own message history
- [ ] Database role can INSERT genuine messages but cannot UPDATE a sent message's author or text
- [ ] Job moves through accepted, en_route, arrived and completed
- [ ] Only assigned tradesperson can change job status
- [ ] Customer can cancel subject to the correct current status
- [ ] A completed real job can receive one authentic review
- [ ] After app restart, all statuses and reviews remain consistent

## D. Urgent job journey
- [ ] Customer can submit an issue; default is blank rather than an invented leak
- [ ] With a genuine online trade, request is sent and acceptance works
- [ ] When there are no real available trades, show unavailable state; do not create a fake match
- [ ] Failed network lookup is distinct from no available trades
- [ ] Customer can retry, browse or post flexible request
- [ ] Tradesperson location tracking is authorised and limited to active matching jobs
- [ ] Cancelling a live request stops further offers / progress

## E. Flexible / Street Run
- [ ] A flexible request is stored in jobs and is visible to eligible tradespeople
- [ ] When no candidate exists, request remains honestly posted rather than pretending to be booked
- [ ] No invented prices, guaranteed savings, detours, grouped homes or time slots appear
- [ ] Tradesperson acceptance creates a valid real job; final price is agreed between parties
- [ ] Actual route-based scheduling and grouping are not advertised as finished until data-backed

## F. Merchant and location map
- [ ] Tradesperson GPS location pin and work-area pin display separately
- [ ] "Centre on me" returns to the right position
- [ ] Closest merchants sort by straight-line miles and directions work
- [ ] Plumbing and electrical suppliers are filtered correctly; shared shops appear for both
- [ ] Leicester fallback works when Overpass fails
- [ ] Other cities show meaningful unavailable/retry states and results when the data source works
- [ ] Precise live coordinates cannot be queried publicly when trade is offline or stale
- [ ] Exact job address is visible only to authorised job participants

## G. Support and account
- [ ] Contact support validates category, subject and message
- [ ] Submitted request appears in Supabase support_requests for the owner
- [ ] Another logged-in user cannot read the request
- [ ] Support queue is checked by an operator before inviting real users
- [ ] Notification preferences are not mistaken for functioning native push
- [ ] Unexpected errors have understandable next actions rather than an indefinite spinner

## H. Security and launch gate
- [ ] Supabase security and performance advisors reviewed
- [ ] Enable leaked-password protection and verify
- [ ] Audit RLS across jobs, offers, conversations, messages and exact location tables using distinct test accounts
- [ ] Check the app doesn't expose service_role secrets
- [ ] Verify authenticated writes on profiles, availability and message tables through the actual mobile client
- [ ] Verify tradespeople cannot directly edit is_verified, is_insured, rating or review_count
- [ ] Add privacy policy, terms, report/block and emergency escalation process
- [ ] Test on smaller iPhone and Android, with poor internet and app force-close
- [ ] Only launch after successful real end-to-end booking and user acceptance tests

**Go/no-go:** Do not mark as launch-ready merely because all UI screens render or Expo publishes an OTA update. Confirm the live customer-to-tradesperson loop and safety controls first.

## New bookings, messaging and journey acceptance criteria (not yet device-tested)

- [ ] Provider publishes weekday working hours; customer sees free suggestions excluding a scheduled private diary booking.
- [ ] A date with no provider hours remains a **preferred request**, not a guaranteed available slot.
- [ ] Customer chooses a real future time/duration and professional acceptance creates exactly one linked diary booking.
- [ ] Conflicting acceptances and overlapping Grid requests fail without double-booking.
- [ ] Customer proposes an alternative time; professional accepts; both see the same saved UK time. Proposer cannot self-approve.
- [ ] Cancelling an accepted job cancels its linked appointment; direct deletion of linked bookings is disallowed.
- [ ] Both sides send a text, a photo-only message and a text-with-photo message; message read receipts and unread badges update.
- [ ] Retry a failed send without duplicate content, load older messages without being forced to the bottom, test offline/online reconnection.
- [ ] Unauthorized third account cannot view private chat attachments or read nonparticipant messages.
- [ ] A professional publishes an On My Way or Street Run window anchored to an existing diary event. Incorrect trade and cancelled anchors are rejected.
- [ ] Customer posts a matching flexible request; professional accepts without a fake confirmed appointment, ETA or price.
- [ ] Proposed route visit fits the published window and 15-minute inter-job buffer, then appears on the journey board.
- [ ] On My Way opens directions through extra visit to the saved original appointment; Street Run opens scheduled time-ordered multi-stop directions.
- [ ] Never claim route directions are an optimised travel plan or that any savings are guaranteed.

All above are separate from CI syntax, TypeScript and unit checks. See [architecture notes](docs/TRADARR_BOOKING_MESSAGING_ROUTING.md).


## I. 19 November 2026 integration verification (not yet device-tested)

**Build status:** The code commits for map clustering, quoted work, ETA updates, and auth recovery passed GitHub Actions TypeScript/Expo/logic checks. This is a build check, not proof that the workflows succeeded with two authenticated phones.

### Customer device + tradesperson device

- [ ] On separate signed-in devices, create a normal job for a genuine tradesperson. Accept exactly once; another trade must not be able to accept or change status.
- [ ] Send a quote from the linked job, then confirm the customer can review the immutable quote snapshot. Decline and request changes in separate test quotes; neither may convert to an invoice.
- [ ] On an accepted quote, convert to an invoice using the transactional RPC. Check `trade_invoices.quote_id`, `app_job_id` / `urgent_request_id`, `source`, owner, totals and `trade_quotes.invoice_id`. Tap Convert twice: exactly one invoice must exist.
- [ ] Agree a booking on both devices. Route job must refuse Start Journey until the appointment is confirmed. Confirm that simultaneous booking attempts do not overlap.
- [ ] With a confirmed On My Way or Street Run visit, select an ETA on tradesperson device and confirm customer sees approximately the same minutes and receives an in-app status alert. Update ETA, arrive, and complete; the old ETA must disappear.
- [ ] Start a Street Run with multiple matched offers. Verify capacity and time windows, exact job addresses remain private, route stop ordering follows confirmed appointments, and map directions are described as approximate rather than guaranteed.
- [ ] Zoom into clusters and back out; a single person must render as an avatar, groups should split before zoom 17 and not change grouping simply by panning.
- [ ] Disable location permission, search a postcode, and check that the map shows the searched area without claiming it is live GPS. Give permission, revisit map, and check recent/high-accuracy position fallback.
- [ ] Disable the internet after activity is loaded, return to Activity and verify a connection warning appears while last-loaded bookings remain visible; reconnect and verify updated statuses.
- [ ] Restart both apps: account type, appointments, quotes, invoice links, and messages must remain correct. Signing out on one phone must not show cached data belonging to another account.
- [ ] Inspect RLS using each signed-in role: nonowners cannot change `jobs.customer_id`, `accepted_tradesperson_id`, appointment fields, protected quote snapshots, rating/verified fields, or invoice source/quote/job links.
- [ ] Test expired Auth session, resending verification after cooldown, offline sign-in/restore, password reset, and retrying the connection. No role may default to Customer merely because its account lookup fails.

**Security configuration still required:** Enable Supabase Auth leaked-password protection in the dashboard. Existing public `SECURITY DEFINER` RPCs require a separate permission review. `tradarr_push_outbox` intentionally has RLS enabled with no client policies (service-only); don't add a public read/write policy just to suppress the linter.

**Real-device status as of this change:** unverified. No customer-to-tradesperson end-to-end journey or authenticated conversion has been performed on two phones. Apple remote push remains unavailable until native APNs credentials and a development build are available.
