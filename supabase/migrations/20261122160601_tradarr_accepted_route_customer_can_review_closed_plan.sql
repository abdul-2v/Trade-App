-- Applied to the connected Tradarr Supabase project as migration 20261122160601.
-- Accepted customers need their journey window after the trader pauses/closes
-- the published route (for example when all extra visits have been accepted).
-- The existing public read policy continues to cover future open plans only.
-- This additional policy never grants access to private diary records or to
-- another customer's matched journey.
drop policy if exists tradarr_route_plan_accepted_customer_read on public.trade_route_plans;
create policy tradarr_route_plan_accepted_customer_read
on public.trade_route_plans
for select to authenticated
using (
 exists(
  select 1
  from public.job_offers offer
  join public.jobs job on job.id=offer.job_id
  where offer.route_plan_id=trade_route_plans.id
    and offer.tradesperson_id=trade_route_plans.tradesperson_id
    and offer.status='accepted'
    and job.customer_id=(select auth.uid())
    and job.accepted_tradesperson_id=offer.tradesperson_id
    and job.job_mode in ('route','street_run')
    and job.status in ('accepted','en_route','arrived','in_progress','completed')
 )
);
