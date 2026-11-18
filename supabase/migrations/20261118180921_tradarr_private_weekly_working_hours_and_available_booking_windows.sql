
-- Optional published weekly availability; private appointments are never exposed.
create table if not exists public.trade_working_hours (
 tradesperson_id uuid not null references auth.users(id) on delete cascade,
 weekday smallint not null check (weekday between 0 and 6),
 enabled boolean not null default false,
 start_local time not null default '08:00',
 end_local time not null default '18:00',
 updated_at timestamptz not null default now(),
 primary key(tradesperson_id,weekday),
 constraint tradarr_work_hours_valid check (start_local < end_local)
);
alter table public.trade_working_hours enable row level security;
drop policy if exists tradarr_working_hours_owner_read on public.trade_working_hours;
create policy tradarr_working_hours_owner_read on public.trade_working_hours
for select to authenticated using(tradesperson_id=(select auth.uid()));
drop policy if exists tradarr_working_hours_owner_insert on public.trade_working_hours;
create policy tradarr_working_hours_owner_insert on public.trade_working_hours
for insert to authenticated with check(
 tradesperson_id=(select auth.uid())
 and exists(select 1 from public.tradesperson_profiles t
            where t.user_id=(select auth.uid()))
);
drop policy if exists tradarr_working_hours_owner_update on public.trade_working_hours;
create policy tradarr_working_hours_owner_update on public.trade_working_hours
for update to authenticated using(tradesperson_id=(select auth.uid()))
with check(tradesperson_id=(select auth.uid()));
grant select,insert,update on public.trade_working_hours to authenticated;

-- Security-definer exposes *only* suggested free windows; job/customer details stay private.
create or replace function public.tradarr_suggest_booking_slots(
 p_trade_id uuid, p_day date, p_duration_minutes integer
) returns table(configured boolean, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare
 hours record;
 local_start timestamp without time zone;
 earliest timestamptz;
 latest timestamptz;
 produced boolean := false;
begin
 if auth.uid() is null or p_trade_id is null or p_day is null
    or p_duration_minutes not in (30,60,90,120,180)
    or p_day < (now() at time zone 'Europe/London')::date
    or p_day > ((now() at time zone 'Europe/London')::date+30)
    or not exists(
      select 1 from public.tradesperson_profiles t where t.user_id=p_trade_id
    ) then
   return query select false,null::timestamptz,null::timestamptz;
   return;
 end if;
 select enabled,start_local,end_local into hours
 from public.trade_working_hours h
 where h.tradesperson_id=p_trade_id
   and h.weekday=extract(dow from p_day)::smallint;
 if not found then
   return query select false,null::timestamptz,null::timestamptz;
   return;
 end if;
 if not hours.enabled then
   return query select true,null::timestamptz,null::timestamptz;
   return;
 end if;
 for local_start in
   select gs
   from generate_series(
     p_day+hours.start_local,
     p_day+hours.end_local-make_interval(mins=>p_duration_minutes),
     interval '30 minutes'
   ) gs
 loop
   earliest:=local_start at time zone 'Europe/London';
   latest:=earliest+make_interval(mins=>p_duration_minutes);
   if earliest<=now()+interval '30 minutes' then continue; end if;
   if exists(
     select 1 from public.trade_appointments a
     where a.tradesperson_id=p_trade_id
       and a.status='scheduled'
       and a.starts_at<latest and a.ends_at>earliest
   ) then continue; end if;
   configured:=true;starts_at:=earliest;ends_at:=latest;
   produced:=true;
   return next;
 end loop;
 if not produced then
   return query select true,null::timestamptz,null::timestamptz;
 end if;
end $$;
revoke all on function public.tradarr_suggest_booking_slots(uuid,date,integer) from public,anon;
grant execute on function public.tradarr_suggest_booking_slots(uuid,date,integer) to authenticated;

