-- Applied to the live Tradarr project as migration 20261123114423 on 2026-11-23.
-- Supabase performance advisor identified missing FK indexes. These are
-- additive, non-unique and do not change any data or row-level security rule.
-- Expected improvement: owner-based lookups, associated-record cleanup, and
-- deletion/integrity checks; actual benefits require future query metrics.
create index if not exists tradarr_appt_customer_fk_idx
 on public.trade_appointments(customer_id);
create index if not exists tradarr_route_tradesperson_fk_idx
 on public.trade_route_plans(tradesperson_id);
create index if not exists tradarr_route_anchor_fk_idx
 on public.trade_route_plans(anchor_appointment_id);
create index if not exists tradarr_customer_proposals_job_fk_idx
 on public.trade_customer_proposals(job_id);
create index if not exists tradarr_customer_proposals_urgent_fk_idx
 on public.trade_customer_proposals(urgent_request_id);
create index if not exists tradarr_invoice_customer_fk_idx
 on public.trade_invoices(customer_id);
create index if not exists tradarr_quotes_customer_fk_idx
 on public.trade_quotes(customer_id);
create index if not exists tradarr_safety_reporter_fk_idx
 on public.tradarr_safety_reports(reporter_id);
create index if not exists tradarr_user_blocks_blocked_fk_idx
 on public.tradarr_user_blocks(blocked_id);
create index if not exists tradarr_push_recipient_fk_idx
 on public.tradarr_push_outbox(recipient_id);
