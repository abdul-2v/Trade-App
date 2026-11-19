# Tradarr — Trust, Safety and Support Operations

Updated 19 November 2026. This file describes the implemented beta workflows and the operations still required. **Passing CI is not a substitute for real cross-account verification.**

## Available features

- Tradesperson Profile → **Evidence & verification** or Account → **Credentials & verification**. Upload genuine PDF/JPEG/PNG/WebP evidence up to 8 MB in the private `tradarr-credentials` bucket. Traders can view status and the review note.
- Customers and tradespeople → Account → **Help, reports & support cases**. Cases have status, priority, a public reply thread, and private PDF/photo attachments in `tradarr-support-evidence`. An existing real tradesperson profile also has a **Report** action.
- Authorised staff → Account → **Staff: Review & safety**. Review private evidence, approve/decline/withdraw credentials, assign and prioritise support, publish replies or write private staff-only notes, and close cases with a resolution.
- Recipient-specific Inbox Activity alerts notify tradespeople of credential decisions and expiry and customers/tradespeople of support case updates.
- Public `tradesperson_profiles.is_verified` is server-computed from staff-approved identity **or business** evidence. Public `is_insured` requires staff-approved insurance evidence whose expiry has not passed. A daily database job removes lapsed insurance badges; it does not verify insurance with an insurer automatically.

## Administrator Gateway and testing account

**Provisioned 19 November 2026:** The verified `abdurhajat@gmail.com` account has a server-managed `tradarr_staff` claim. The original account and customer records were preserved. **No separate login or shared admin password has been created.**

- Re-sign into Tradarr to refresh the account claim, then open **Customer → Account → Admin Gateway · Secure access**.
- The gateway requires an authenticator app with a six-digit TOTP code. Set up the factor inside the gateway. The database explicitly requires an `aal2` session before showing credential evidence, staff-only case notes or permitting reviewer decisions. Password-only sessions are insufficient, even if the account has the staff claim.
- The same email can use **Customer → Account → Test tradesperson view**. This opens the Pro profile and lets the account owner set up an actual business name and trade. No fictional business was created automatically. On saving valid details, a tradesperson profile is inserted and `profiles.account_type` is changed to `tradesperson`, while the same account retains its customer jobs and data.
- In Pro → Account, **Switch to customer app** returns to the ordinary customer interface. The admin gateway is also linked from the professional Account screen.
- Switching viewpoints does **not** simulate two distinct identities. Genuine customer-to-trader messaging, accepting one's own requests, cross-account privacy and live booking tests still need another customer/tradesperson account.

### Adding or removing other staff

Use the **Supabase Auth Admin API from a trusted server only**, preserving all existing app metadata. Never include a Supabase service-role key in the Expo application:

```ts
await supabaseAdmin.auth.admin.updateUserById(chosenStaffUserId,{
  app_metadata:{...existingAppMetadata,tradarr_staff:true}
});
```

Remove the claim through the trusted Auth Admin API to revoke access. The database checks `auth.users.raw_app_meta_data` on every staff request, so revoked roles stop working even with a stale JWT. The additional MFA `aal2` session is required for every sensitive staff action.

**Security:** The administrator password must be changed if it was shared in plaintext. Do not store credentials in the app, source code, GitHub, public comments, chat case notes or support attachments. Auth leaked-password protection remains to be enabled from Supabase Auth settings.

## Support operations

1. Designate a human team member to check the triage queue regularly and establish a response policy. The app currently tells users the early-access queue is **not monitored continuously**.
2. For safety reports, save a case note, assess evidence, and do not close a case without a documented outcome.
3. Only authorised staff should review insurance expiry and policy details before approving. Never auto-approve an upload. Revocation is recorded and updates public badges.
4. Do not use internal-only messages for customer-facing replies. Customers can access only public replies and their own evidence; unrelated accounts cannot open them.
5. Set document retention, deletion and data subject access procedures before public launch. Storage is private but not automatically erased with a support case or Auth user.

## Security decisions and known work

- Private credential and support evidence buckets are **not public**; participant/owner and staff Storage RLS grants control signed URL generation.
- Support case priority, assignment and outcome are staff-controlled. Submitted evidence and original case reports cannot be silently edited by customers.
- Credibility badges are **not user-editable**. A fake JWT staff claim was rejected in a database negative test.
- Existing `tradarr_push_outbox` has RLS with no client policies **by design** (service-only queue).
- Supabase still warns on three intentionally exposed privileged RPC functions: `tradarr_observed_job_prices`, `tradarr_suggest_booking_slots` and `trade_invoice_customer_details`. They need an explicit data-leakage and permission review before wider launch; do not suppress warnings without replacing their access models.
- **Supabase Auth leaked-password protection is not enabled.** Enable it via the Auth settings and verify registration/password-reset behaviour.
- Actual automated account deletion, app-store compliance review, and native push credentials are **not complete**.

## Two-role acceptance tests still required

- [ ] Trade A uploads identity, business, insurance and qualification evidence. Trade B cannot list, sign or change Trade A's documents or submission status.
- [ ] Customer A cannot read staff notes or another customer's support case. A forged staff claim cannot grant privileges.
- [ ] With a legitimately authorised staff account, review, reject and approve credentials. Verify public badges reflect decisions; for insurance require a **future expiry**. Revoke and verify removal.
- [ ] Set an insurance expiry to yesterday in an authorised test case and run the scheduled expiration function in a staging environment. Ensure the badge goes away and a notification arrives.
- [ ] Submit a customer report, add private evidence and a public reply; staff can review and respond. Staff internal-only note must not appear on the customer account.
- [ ] Change support case priority and status as staff; a customer must not be able to directly set high/urgent priority or a resolution by calling the API.
- [ ] Open signed evidence links on separate phones; verify files are not world-readable.
- [ ] Confirm CI checks, then test customer and tradesperson bookings, messages, quotations, invoices and reviews end-to-end.
- [ ] Verify account deletion, moderation escalation, retention policy, and App Store/Play Store safety requirements before beta release.

Use `npm run dev:auto` for the existing Expo Go workflow. Apple remote notifications still require compatible native credentials and a development/production build.
