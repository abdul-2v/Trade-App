-- Fix circular row-level-security dependencies:
-- jobs SELECT -> job_offers SELECT -> jobs SELECT and
-- urgent_requests SELECT -> urgent_request_offers SELECT -> urgent_requests SELECT.
-- Do not loosen either table's participant authorization.

create or replace function trade_private.is_customer_of_market_job(p_job_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.jobs j
    where j.id = p_job_id and j.customer_id = (select auth.uid()));
$$;

create or replace function trade_private.is_customer_of_urgent_job(p_request_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.urgent_requests r
    where r.id = p_request_id and r.customer_id = (select auth.uid()));
$$;

revoke all on function trade_private.is_customer_of_market_job(uuid) from public, anon;
revoke all on function trade_private.is_customer_of_urgent_job(uuid) from public, anon;
grant usage on schema trade_private to authenticated;
grant execute on function trade_private.is_customer_of_market_job(uuid) to authenticated;
grant execute on function trade_private.is_customer_of_urgent_job(uuid) to authenticated;

drop policy if exists job_offers_participants_read on public.job_offers;
create policy job_offers_participants_read on public.job_offers
for select to authenticated
using (
  tradesperson_id = (select auth.uid())
  or trade_private.is_customer_of_market_job(job_id)
);

drop policy if exists urgent_offers_participants_read on public.urgent_request_offers;
create policy urgent_offers_participants_read on public.urgent_request_offers
for select to authenticated
using (
  tradesperson_id = (select auth.uid())
  or trade_private.is_customer_of_urgent_job(request_id)
);
