
-- Defence in depth: the outer route start must actually match the diary anchor.
drop policy if exists tradarr_route_plans_insert on public.trade_route_plans;
create policy tradarr_route_plans_insert on public.trade_route_plans
for insert to authenticated with check(
 tradesperson_id=(select auth.uid())
 and status='open'
 and starts_at>now()
 and starts_at<now()+interval '30 days'
 and exists(
  select 1 from public.trade_appointments a
  where a.id=trade_route_plans.anchor_appointment_id
    and a.tradesperson_id=(select auth.uid())
    and a.status='scheduled'
    and abs(extract(epoch from(a.starts_at-trade_route_plans.starts_at)))<86400
 )
);
create or replace function trade_private.tradarr_route_trade_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(
  select 1 from public.tradesperson_profiles t
  where t.user_id=new.tradesperson_id and t.primary_trade=new.trade
 ) then
   raise exception 'Published journey must match your registered primary trade'
   using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists tradarr_route_trade_guard on public.trade_route_plans;
create trigger tradarr_route_trade_guard
 before insert or update of trade,tradesperson_id on public.trade_route_plans
 for each row execute function trade_private.tradarr_route_trade_guard();
do $$ begin
 if not exists(select 1 from pg_constraint where conname='tradarr_route_latitude_valid') then
  alter table public.trade_route_plans add constraint tradarr_route_latitude_valid
  check(start_latitude between -90 and 90 and end_latitude between -90 and 90
    and start_longitude between -180 and 180 and end_longitude between -180 and 180);
 end if;
end $$;

