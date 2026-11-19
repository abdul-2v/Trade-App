# Tradarr Crew — test plan and UK public-launch requirements

State: private development/testing. Acceptance in the app is an introduction, not an employment contract, confirmed job booking, completed apprenticeship or right-to-work verification.

## Implemented

- Tradesperson > Tools > Crew: paid helper, skilled mate and apprenticeship adverts, own listings, applications, shortlist/accept/decline, saved people.
- Independent Crew signup (18+ in current MVP), with no customer-facing tradesperson listing.
- Worker profiles (self-described skills and opt-in visibility), applications and withdrawal.
- Private participant-only application messages and Crew Activity notifications; trader updates feed the existing Inbox.
- Coarse town/area listings, no exact coordinates and no background worker tracking.
- Supabase ownership policies, suspended-account and mutual-block checks, server-side accepted-capacity controls, and restricted table grants.

## Remaining launch gaps

- Area search currently uses area text; not calibrated distance, live GPS or map pins.
- No automatic contract, payroll, worker classification, verified identity, competence, right-to-work or approved apprenticeship training enrolment.
- No platform-specific staffing insurance assessment or documented recruitment compliance sign-off.
- Worker and hirer live push delivery depends on the separate Expo/Apple push setup.
- 18+ only initially. The platform does not support under-18 apprenticeship applicants in this MVP.
- Robust anti-spam/rate limiting and expanded Crew-specific reporting need sign-off.

## Official UK references / operational requirements

1. Employment agency and employment business rules can extend to ONLINE matching platforms. Review duties around worker suitability and information provided before placements, contract documents, prohibitions on certain worker fees and record keeping. https://www.gov.uk/government/publications/conduct-regulations-2003-guidance-for-employment-agencies-and-employment-businesses/overview-of-the-conduct-regulations-2003
2. Apprenticeship adverts are not formal apprenticeships: employers must arrange an approved training provider, written apprenticeship agreement and training plan and comply with funding and wage rules. https://www.gov.uk/employing-an-apprentice
3. Applicable minimum wages vary by worker age and apprenticeship stage. The 2026-27 apprentice minimum is GBP 8/hour for eligible apprentices; NOT every 18+ person or apprentice qualifies for that wage. https://www.gov.uk/national-minimum-wage-rates
4. The hirer must assess safety risks, PPE, training, supervision and worksite access. https://www.hse.gov.uk/vulnerable-workers/gig-agency-temporary-workers/employer/roles-of-suppliers-end-user-businesses.htm
5. Update privacy notices, handling of worker data and retention, moderation/anti-discrimination, identity checks in secured channels, and data deletion process before commercial public launch.

## Private QA acceptance matrix

- Customer account has no Crew entry; tradesperson sees Crew from Tools.
- New Crew-only signup creates no public tradesperson profile or map pin.
- Worker must be 18+ and publish a Crew profile to apply.
- Hirer can post a paid request for helper, skilled mate or apprenticeship.
- Worker searches opportunities and applies once per request.
- Hirer sees applicants, shortlists, accepts or declines; number accepted cannot exceed places.
- Worker withdraws; other account cannot withdraw or decide for them.
- Worker and hirer alone see application messages and in-app Activity updates; tapping alert opens the correct private thread.
- Blocked users cannot establish new applications or message each other.
- Paused or suspended traders cannot post or accept; expired or closed opportunities cannot accept.
- Anonymous users cannot access any Crew database table.
- A worker who hides their public profile vanishes from People browse.
- Restart Expo and verify all persisted data.
- Run syntax, TypeScript and booking regression tests in GitHub Actions.
- Test on separate accounts/devices and review legal requirements before public launch.
