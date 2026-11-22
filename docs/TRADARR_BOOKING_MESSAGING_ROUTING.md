# Tradarr – scheduling, messaging and route matching (18 November 2026)

Status: implemented for controlled beta; **not yet signed off on physical devices or real bookings**.

## Product rules

A customer request and a confirmed booking are different states. The customer chooses an exact UK-local preferred start and duration; the tradesperson accepts the offer before the database reserves the time. A client must never claim the proposed time is already confirmed. Published working hours are used for *suggestions*, not auto-acceptance.

An agreed change to a confirmed appointment requires mutual approval. Only the participant who did **not** propose the change may approve/decline it; the proposer may withdraw. Postgres prevents confirmed appointment overlaps even if two phones act concurrently. Confirmed marketplace bookings are linked to the job and not independently deletable.

Appointments and route windows are stored as `timestamptz` and rendered in `Europe/London`, not the handset's time zone. Spring-forward nonexistent times are rejected. UI starts use 30-minute intervals; bookings can use 30, 60, 90, 120 or 180 minutes.

## Customer booking journey

1. Browse real professional profile and tap **Request appointment**.
2. Choose service, date and estimated duration. If working hours have been published, call `tradarr_suggest_booking_slots` to show free suggestions without revealing anyone else's booking details. If no hours have been published, present times as preferences only.
3. Customer posts a job/offer with `requested_start` and `requested_end`.
4. Professional accepts. A job status trigger reserves an appointment; overlapping acceptances fail atomically. The app must show the actual response rather than optimistically claiming success.
5. Both participants see the agreed time and may request changes. Cancelling the job cancels the linked booking.

Weekly schedules are optional and owned by the tradesperson. A free-time preview can become stale; the database is the final authority. There is currently no automatic Google/Apple Calendar sync.

## Tradesperson diary and Grid

`trade_appointments` is the canonical calendar for private events, accepted jobs and accepted Grid slots. Private events can be edited by their owner. Linked marketplace appointments require the applicable job or approval workflow for time/status changes. Grid acceptance creates a reserved appointment and marks its slot booked in the same transaction. All confirmed events block overlaps.

The weekly-hours editor is at **Tradesperson → Tools → Working hours & availability**; the diary remains **Tools → Job diary**. Providers should configure hours before inviting customers to request slots.

## Secure messaging

Both account modes use `UnifiedMessagesScreen`, with persistent conversations, 50-message history pagination, unread badges, read receipts, retry-safe client tokens, and convenient quick replies. Messages are immutable except the recipient may mark a message read. A Realtime listener provides in-app updates, with foreground re-sync as a fallback.

Photo attachments are stored in the private `tradarr-chat` bucket under `conversation UUID/sender UUID/photo UUID`. Policies restrict uploads to a participant's folder and reads to participants. Signed viewing URLs are temporary; photos are not public profile images. JPEG/PNG/WebP bytes are checked against the advertised MIME type. Failed sends keep draft and photo for retry.

**Still required for public launch:** native push delivery, moderation/reporting workflow for abusive conversations, lifecycle management for orphaned uploads and a retention policy. Realtime Postgres Changes is appropriate for a small controlled pilot; for broad scale review Supabase Broadcast authorization/performance.

## On My Way

A professional publishes a journey linked to a **confirmed, upcoming diary appointment**. For On My Way, the route window is the 75 minutes before the anchor appointment, with at most **one** extra visit. The geographic shortlist uses approximate corridor distance from rounded public route coordinates. This is **not** a road-network or traffic estimate. Customer interest is offered to eligible journey owners.

When a professional accepts an enquiry, **no visit time is silently confirmed**. One participant proposes a time; the other approves; the server enforces the published journey window, a 15-minute separation from other booked work and the no-overlap invariant. If the anchor appointment moves or is cancelled, its published journey closes.

Accepted, scheduled extra work appears on the journey board, with direct navigation. When the anchor appointment has a saved destination address, the Google Maps route passes through the extra stop and finishes at the existing appointment.

## Street Run

A professional chooses Street Run for an appointment-anchored post-visit group window (currently three hours), a 1–10 mile rough coverage radius and a maximum of 1–4 extra visits. Offers are matched using approximate distance to the *group area*, not an invented multi-stop savings model. Accepted jobs remain pending an agreed visit time.

The journey board lists accepted visits, unconfirmed visits and actual appointment times separately. It offers individual Google Maps directions and a time-ordered multi-stop URL for up to four confirmed stops. **Time order is not an automatically optimised route**, and Google Maps mobile URLs support at most three intermediary waypoints. For more stops, users open separate legs.

## Privacy and external navigation

Precise home/work locations are not exposed in public route publication. Exact job locations are restricted by RLS to the customer and accepted provider. When navigating, the professional explicitly opens Google Maps; exact stop coordinates are then passed to the maps provider. The app never markets approximate corridor distance as a verified detour, travel time, confirmed price or discount.

A production-grade optimiser would require a **server-side** road routing provider (e.g. Google Routes API/Route Optimization), explicit API billing/security controls, reliable property geocoding, job durations and time-window feasibility. Do not put server credentials in the Expo client, and do not enable or advertise optimised routes before verified results exist.

## Required test cases before pilot

- Two account devices: customer request, provider acceptance and confirmed shared diary entry.
- Competing acceptances and two bookings at the same time: only one confirmed reservation.
- Provider existing diary conflict, overlapping Grid booking and an expired requested time.
- Proposal to reschedule, counterparty approve/decline, proposer withdrawal, concurrent approvals and cancelled job.
- Europe/London summer/winter clock changes and invalid date/time input.
- Published weekday hours, a closed day, fully booked day, empty provider schedule and a 30-minute session at the edge of working hours.
- Customer-to-provider text/photo send, offline retry without duplicate, chat pagination without auto-scroll, photo-only send and read receipts.
- Denied photo permission, large files, JPEG/PNG/WebP MIME mismatch, unauthorized object access and signed URL expiry.
- Published route matching, job outside corridor, stale/closed route, invalid trade, max-visit capacity, cancelled anchor and proposed visit outside window.
- Navigate a real On My Way detour + anchor destination and Street Run ordered stops; do not show unconfirmed addresses or estimated discounts as facts.
- iPhone and Android physical devices, background/foreground transitions and weak connectivity. Automated syntax/TypeScript/unit tests are necessary but **not** equivalent to real-device sign-off.

## External design references

- Supabase Realtime (Postgres Changes/Broadcast): https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- Supabase Storage RLS: https://supabase.com/docs/guides/storage/security/access-control
- Google Maps URL waypoints: https://developers.google.com/maps/documentation/urls/get-started
- Google Routes API real waypoint optimisation: https://developers.google.com/maps/documentation/routes/opt-way

The public release is intentionally deferred until the manual tests and remaining account/security/notification requirements are finished.

## 22 November 2026 — confirmed-address navigation and accepted-route access

- Journey discovery continues to use **approximate postcode-area coordinates** only. These are NOT precise property destinations.
- A tradesperson may save the full customer-confirmed destination on their **private linked appointment**. This appointment is restricted by existing ownership/participant RLS and the link guard; other users must not see private job addresses.
- On My Way cannot be published without a complete original diary destination. Google Maps links for stops use saved full addresses, not the approximate `job_locations` latitude/longitude.
- Confirmed route destinations are retained even after the booking's start time: the planner loads accepted linked appointments separately from future anchor appointments.
- Traffic-aware route previews still estimate travel **between approximate postcode areas**. They must not automatically reorder exact booked visits or make door-to-door travel-time / monetary saving promises.
- Migration `20261122160601` grants an accepted job customer read access to their own **paused or closed route plan** to validate mutually agreed time changes, without opening other customers' route records.
- Route and booking screens re-check when the app returns to foreground. New proposals are blocked if an accepted flexible journey's window is temporarily unreadable.

### Two-account launch acceptance test

1. As trader, create a future private diary visit with full confirmed property address, then publish On My Way. Verify a missing anchor address blocks publishing.
2. As customer, submit a flexible route request. As trader, accept the offer. Verify the route job remains **unbooked** until the other party approves a proposed appointment time.
3. As trader, save the full customer-confirmed address on the accepted linked appointment. As customer, verify only this job's visit appears in customer bookings.
4. Attempt to navigate before saving a full address; the app must refuse. After saving, ensure Google Maps contains the full address, **not postcode-centroid coordinates**.
5. Pause/close the published route and verify the customer can still review its accepted booking window. Verify unrelated accounts cannot read the route or address.
6. Move past the appointment start, refresh the app and verify the address stays available for the active stop.
7. Test conflicting appointment approval on both devices, expired sessions, slow postcode lookup, foreground refresh and old traffic-preview responses.
8. Confirm service-key setup before claiming real traffic-aware estimates. Without Google Routes credentials, basic verified-address directions must still work.

Automated tests do not replace this physical-device acceptance test. 