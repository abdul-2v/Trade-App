# Tradarr · map, route and admin release acceptance (19 November 2026)

## Implemented and source-controlled

- **Customer marketplace map:** one RLS-protected, location-bounded database function returns a maximum of 350 candidate profiles per search; the app filters them to each trader's advertised service radius. Marker bucketing remains anchored to world pixels so a map pan does not rearrange clusters. Progressive zoom and a density cap reduce pin overload. The actual app's performance with thousands of users **has not** been benchmarked on a device.
- **Merchant map:** UK full-postcode/outcode search, a searched-area reference that does not get overwritten by subsequent GPS updates, retries through two best-effort OpenStreetMap Overpass endpoints, clear location labels, a merchant-specific camera focus above the information panel and a high-zoom unclustered selected marker.
- **Location privacy:** public presence is deliberately rounded/approximate. Precise trade GPS can be read by the owner, or only by an authorised customer in an active matched job if availability is still live, enabled and updated within three minutes. Exact job addresses are restricted to participants under RLS. No coordinates are granted to unrelated accounts. The database read-model uses SECURITY INVOKER and limits data by area.
- **On My Way / Street Run:** existing time-confirmation, buffers, booking conflicts and message journeys are retained. The on-demand `tradarr-road-route` Supabase Edge Function, requiring a genuine signed-in route owner, can request traffic-aware road driving times from the Google Routes API, calculate extra driving time against a direct On My Way route, and evaluate optional Street Run waypoint orders. It only adopts a proposed reorder if compatible with all confirmed appointment windows. It does **not** calculate unverified monetary savings or guarantee arrival.
- **Administrator gateway:** staff-only entry and AAL2 TOTP remain enforced server-side; returning to the foreground rechecks access. Customer and tradesperson testing exits are visible from the admin overview, and a read-only health check verifies role, MFA, admin metrics and directory access.

## Remaining service setup

**Google Routes API:** A server-side `GOOGLE_ROUTES_API_KEY` Supabase Edge Function secret is required. Before setting it, activate billing, enable the Google Routes API and set a conservative daily quota and billing alerts in Google Cloud. Do **not** put this credential into `App.tsx`, `.env` with `EXPO_PUBLIC_`, or a mobile API bundle. Without this secret, the route preview deliberately reports that the service is not configured; existing Google Maps navigation links still work.

Google may charge for traffic-aware and optimized route queries. Both the direct and via-stop journeys may need separate requests. Keep road-preview requests user-initiated while pricing and safeguards are validated. Public Overpass endpoints remain best-effort; do not promise guaranteed coverage of every town or merchant.

## Physical-device acceptance: NOT yet signed off

### Merchant and customer maps

- [ ] With GPS authorised, deny/re-allow permission, set a saved work area elsewhere and check distinct symbols and distance labels.
- [ ] Search LE1, B1 1AA, M1, SW1A 1AA, NG1 and at least one rural postcode. Confirm UK postcode-centre results are labelled as searched, not live location.
- [ ] From the merchant strip, tap a merchant: its pin must remain clearly visible above the bottom card. Close and reopen; pan, zoom and open nearby clusters; camera must not zoom out to a meaningless connecting line.
- [ ] Zoom the customer map from 10→17, pan around a dense area, select a single trader, and compare to list results. Check map clustering, labels and demo-vs-real separation.
- [ ] With location permission denied or network interrupted, the screen must never loop indefinitely or imply fake live locations.
- [ ] On an iPhone and Android handset, profile map visibility, recenter, app background/foreground, weak internet and landscape/small-screen layouts must be examined.
- [ ] Stress test in an isolated environment with **synthetic**, clearly labelled datasets (1,000 / 5,000 / 10,000 markers); measure frame time, pin load and memory on devices. The live project currently has only two trader profiles; present observations are not proof of real-world scale.

### Booking, On My Way and Street Run

- [ ] With two distinct accounts and two phones, request, accept, decline, cancel and reschedule normal, urgent and flexible bookings; test conflicting confirmations.
- [ ] Confirm time windows, the 15-minute inter-job buffer, a moved/cancelled anchor, capacity limit and direct Google Maps navigation for scheduled stops.
- [ ] After the Google Routes secret is configured, request road calculations with one accepted On My Way visit and with Street Run multi-stop visits. Compare with Google Maps road directions and manually validate traffic/ETA differences.
- [ ] Introduce a route with a tempting shorter order that **conflicts** with appointments; the app must preserve scheduled order. Check routes with incomplete addresses and an unavailable provider.
- [ ] Price savings must remain unavailable until verified standard and route-specific quotations have been agreed and backed by data; do not invent discounts.
- [ ] Try malformed or unauthorised plan IDs and access from another trader: the private Edge Function must reject these before issuing Google requests.

### Admin gateway

- [ ] On the admin iPhone, enter using the staff account and authenticator, browse analytics, user lists, cases, verification and review moderation.
- [ ] Run **Admin health check**; confirm current staff role, AAL2, protected dashboard and directory are all reported accurately.
- [ ] Switch to Customer and back, then to Tradesperson and back; administrative controls must not appear in either ordinary view.
- [ ] Suspend and reinstate a disposable trader, moderate a test review, process a test appeal, investigate a report and verify the audit trail (reason, actor, time).
- [ ] Background and resume the admin gateway; revoke staff access or downgrade MFA in a safe test account; confirm the gateway refuses privileged access.
- [ ] Verify unrelated accounts cannot open staff RPCs, bypass moderation RLS or read confidential support evidence.
- [ ] Confirm account deletion and policy requirements in the existing release plan; do not use real customer accounts for destructive test operations.

## What a green CI check proves

GitHub Actions currently checks syntax, UX button wiring, compatible Expo packages, TypeScript and marketplace logic. A green build **does not** mean we have observed a successful iPhone journey, a working Google billing-enabled route computation, or full administrator security validation. Public release remains gated on device, data-permission, billing and support checks.
