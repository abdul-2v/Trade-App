# Shared Tradarr transactional email release
Both app and website use the same Supabase notification events. Do not send directly from clients.
Migration 20261128111817 is applied to the shared project; global control remains OFF. The dispatcher is deployed, and the five-minute cron is guarded by this control and Vault credential.
## Activation (do not enable until verified)
1. Verify official sending domain in Tradarr's dedicated Resend account; set SPF/DKIM and confirm DMARC. Confirm final HTTPS workspace origin and functioning reply/support address.
2. Set server-only Edge Function secrets TRADARR_RESEND_API_KEY, TRADARR_EMAIL_FROM, TRADARR_SITE_ORIGIN, TRADARR_EMAIL_DISPATCH_SECRET (random strong secret). Store matching dispatch secret in Supabase Vault as tradarr_email_dispatch_secret. Set TRADARR_EMAIL_ENABLED=true only after testing. Never expose secrets in Git or client environments.
3. Configure Supabase Auth SMTP separately via smtp.resend.com using verified sender and actual credentials. Install and test signup and recovery templates, other Auth security events and redirect allowlist.
4. Wire verified bounce/complaint webhook events to the private suppression table and delivery ledger; verify signatures and replay protection. Provider accepted is not delivered. Create app/web settings UI for owner-only tradarr_email_preferences. Optional message and opportunity notices are OFF by default.
5. Test with controlled accounts and real provider receipts: no public data access, no duplicated retries, recipient changes, opt-outs, cross-platform triggers, delayed reminders and bounced/complaint addresses. No marketing without separate consent.
6. Enable the database singleton only after testing. No historical backfill. To stop, disable the singleton and unset TRADARR_EMAIL_ENABLED.
## Coverage
14 existing server-generated notification kinds: job offers/acceptance/status, bookings/changes/reminders, quote/invoice, message, route match, verification, support, admin and Crew.
Message reminders delayed 15 minutes, one queue slot per recipient per 30-minute bucket; read notifications suppressed. Not a complete unread-conversation digest. Opportunity updates optional. Existing notification semantics determine recipients.
Retries stop within 12 hours and use stable provider idempotency keys (Resend retains keys 24h); database claims have ten-minute leases. No private user data embedded in messages.
Still to implement/verify: additional job creation/completion/cancellation recipients where no current notification exists; welcome, account changes/deletion, payments/overdue reminders, scope/handover, support acknowledgement/contact forms, subscription events, signed delivery webhooks, UI preferences, retention and end-to-end delivery. No automatic customer emails have been sent.
