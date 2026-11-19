# Tradarr Business Suite — implementation and verification

## Overview
Twelve features are grouped into four discoverable sections under **Tradesperson → Tools**; the customer app remains unchanged and no subscription controls are introduced.

### Features and actual current behaviour
1. **Opportunity Radar:** Stores trade/distance/value preferences; filters **real offers addressed to the signed-in trader**; links to the Jobs marketplace. It does not create leads or guarantee matches.
2. **Smart Quote Studio:** Editable scope and cost estimate including materials markup; saves reusable quote-scope templates; shares drafts; links to the existing full quote/PDF workflow. Not AI-generated and not a legally issued quote automatically.
3. **Business Assistant:** Data-based recommendations using a trader's real quotes, invoices, appointments, customers and costs. Deliberately **not** marketed as an AI model until a secure server-side AI service and privacy permissions are configured. Does not auto-send.
4. **Smart Diary & Gap Filler:** Spots gaps of 60+ minutes between future scheduled diary appointments; opens booking Grid, diary, hours and route planner. Does not claim precise travel times or automatically dispatch.
5. **Job Command Centre:** Owner-only, persistent checklist for accepted standard and urgent jobs.
6. **Money Hub:** Invoiced, sent/unpaid, marked paid and recorded costs drawn from existing business records; no bank confirmation, payroll or HMRC filing.
7. **Crew Operations:** Accepted Crew applications, private work-hours logs and estimated labour costs; links to Crew hiring; not formal payroll or employment confirmation.
8. **Repeat Customer Engine:** Private service reminders tied to the trader's own saved customers; manual customer message draft and completion tracking. No automatic messages.
9. **Business Booking Profile:** Editable business contact card and native OS share; an external hosted public booking webpage/URL is **not yet live**.
10. **Document Vault:** Private PDF/image/DOCX upload, metadata, expiry label, short-lived signed retrieval and deletion; separate from staff identity/insurance verification.
11. **Business Insights:** Record-based KPIs, rough quote conversion rate, paid/sent invoice sums and next actions.
12. **Growth Toolkit:** Saved follow-up/review/customer-care drafts for manual sharing, without bulk messaging.

## Research informing the workflows
- ServiceM8: https://www.servicem8.com/uk/feature-overview (job cards, reminders, checklists, online bookings)
- Tradify: https://www.tradifyhq.com/uk/features (quoting, scheduling, timesheets, invoicing, customer history)
- ICO PECR: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/ (marketing vs service messages, consent/soft opt-in)
- UK VAT record keeping: https://www.gov.uk/charge-reclaim-record-vat/keeping-vat-records (retention and MTD duties)
- HSE competence: https://www.hse.gov.uk/electricity/withequip.htm (documents do not themselves prove competence)

## Security / controls
- The seven new tables have owner-only RLS and limited client update grants; activity is restricted to active tradesperson profile accounts.
- A reminder can only reference a customer owned by the same tradesperson.
- A job checklist can only be attached to a job accepted by the account holder.
- Crew hours can only be logged for an application accepted by that same hirer.
- Storage uses the **private** `tradarr-trade-vault` bucket, 10 MB object limit and UUID owner-prefixed paths, with signed URLs of 120 seconds.
- Marketing and quote follow-ups require human action; no bulk send or automatic invoicing.
- No client-side API secrets or fake customer data have been added.

## Test outcomes
- GitHub App TypeScript check and existing marketplace logic suite pass on the feature branch.
- Supabase migration applied successfully and seven new tables have owner-only RLS policies.
- Cross-account transactional QA passed: owner can create/view data; a second tradesperson cannot view the first one's template/reminder/document metadata or attach a reminder to someone else's customer; a customer account cannot create or read trader-owned data. Entire synthetic test transaction rolled back.
- **Still needs manual Expo Go iPhone/Android checks**: layout, keyboard avoidance, large data sets, document upload/open/delete, user navigation, multi-account switching and accessibility.
- **Not yet production-complete**: hosted public booking webpage, generative AI provider/backend, automated customer rebooking, automatic precise route-based opportunity generation, payment processing or payroll. Do not describe these as live.

## QA suggestions
1. Switch customer ↔ tradesperson and confirm Suite only on the tradesperson Tools tab.
2. Open all 12 screens and return using Back and bottom navigation.
3. Save/reopen Radar; save/share/delete quote and growth templates.
4. Create a customer, save an annual service reminder, mark done, verify no message sent.
5. Accept a real test job; add/check/delete a private task.
6. Accept a Crew application and log internal work hours.
7. Upload PDF and image; open via signed link; delete; check second account cannot access files.
8. Compare totals in Money Hub and Insights with underlying invoice and quote records.
9. Test network errors, re-login, foreground refresh and slow devices.

## Product decision
Keep existing Tools' quote/invoice/diary/customer/crew/route features as the canonical systems instead of launching duplicates. The new Suite extends them with preferences, business operations, cross-feature summaries and reusable records.
