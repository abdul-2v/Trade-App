# TradeHub release test plan

**Environment:** staging/test accounts only; do not send real customers to demo profiles.
**Tester:** one customer, one real tradesperson, two physical phones, Supabase dashboard for records and GitHub Actions / Expo for build status.

## A. Build and authentication
- [ ] Latest GitHub Actions TypeScript check completed successfully
- [ ] Expo native compatibility is clean, and latest OTA update is visible on phone
- [ ] New customer can register, verify email, sign in, sign out and sign back in
- [ ] New tradesperson can register, select trade, verify email, and publish business profile
- [ ] Correct role is restored after force-closing / restarting the app
- [ ] Password reset and account deletion are not marked complete until implemented and tested

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
- [ ] Add privacy policy, terms, report/block and emergency escalation process
- [ ] Test on smaller iPhone and Android, with poor internet and app force-close
- [ ] Only launch after successful real end-to-end booking and user acceptance tests

**Go/no-go:** Do not mark as launch-ready merely because all UI screens render or Expo publishes an OTA update. Confirm the live customer-to-tradesperson loop and safety controls first.
