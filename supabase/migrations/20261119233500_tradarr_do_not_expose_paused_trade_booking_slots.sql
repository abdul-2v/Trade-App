CREATE OR REPLACE FUNCTION public.tradarr_suggest_booking_slots(p_trade_id uuid, p_day date, p_duration_minutes integer)
 RETURNS TABLE(configured boolean, starts_at timestamp with time zone, ends_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    or trade_private.tradarr_trade_paused(p_trade_id)
    or trade_private.tradarr_account_suspended((select auth.uid()))
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
end $function$
;
revoke all on function public.tradarr_suggest_booking_slots(uuid,date,integer) from public,anon;
grant execute on function public.tradarr_suggest_booking_slots(uuid,date,integer) to authenticated;
