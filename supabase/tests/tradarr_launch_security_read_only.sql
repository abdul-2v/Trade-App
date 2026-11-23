-- Run read-only in Supabase SQL editor after migrations. Raises on security
-- regression; never inserts production accounts, job data or messages.
do $launch_security$
declare missing_rls text;
begin
 select string_agg(t.name, ', ') into missing_rls
 from unnest(array['profiles','tradesperson_profiles','jobs','job_offers',
 'job_locations','conversations','messages','trade_appointments',
 'trade_invoices','support_requests','tradarr_notifications',
 'tradarr_push_devices','tradarr_safety_reports',
 'tradarr_account_deletion_requests']) as t(name)
 left join pg_class c on c.oid=to_regclass('public.'||t.name)
 where c.oid is null or not coalesce(c.relrowsecurity,false);
 if missing_rls is not null then
   raise exception 'Core tables without RLS: %',missing_rls;
 end if;

 -- RLS alone is not enough if an anonymous user can call a definer RPC.
 if exists(
  select 1 from pg_proc x join pg_namespace n on n.oid=x.pronamespace
  where n.nspname='public' and x.prosecdef
    and has_function_privilege('anon',x.oid,'EXECUTE')
 ) then raise exception 'Anonymous can execute public definer RPC'; end if;

 -- Existing admin RPCs rely on a live, verified AAL2 staff session.
 if exists(
  select 1 from pg_proc x join pg_namespace n on n.oid=x.pronamespace
  where n.nspname='public' and x.prosecdef
    and has_function_privilege('authenticated',x.oid,'EXECUTE')
    and x.proname like 'tradarr_admin_%'
    and (position('staff_authorised' in pg_get_functiondef(x.oid))=0
         or position('auth.uid()' in pg_get_functiondef(x.oid))=0)
 ) then raise exception 'Admin RPC without staff/MFA gate'; end if;

 if not (select
   pg_get_functiondef('trade_private.tradarr_staff_authorised()'::regprocedure)
     like '%auth.sessions%'
   and pg_get_functiondef('trade_private.tradarr_staff_authorised()'::regprocedure)
     like '%raw_app_meta_data%'
   and pg_get_functiondef('trade_private.tradarr_staff_authorised()'::regprocedure)
     like '%aal2%'
 ) then raise exception 'Staff guard lost live MFA verification'; end if;

 if not (select
   pg_get_functiondef('public.tradarr_suggest_booking_slots(uuid,date,integer)'::regprocedure)
     like '%earliest at time zone ''Europe/London''%'
 ) then raise exception 'UK DST-safe booking slot protection missing'; end if;
end $launch_security$;

select 'PASS' result,
 (select count(*) from pg_proc x join pg_namespace n on n.oid=x.pronamespace
  where n.nspname='public' and x.prosecdef
  and has_function_privilege('authenticated',x.oid,'EXECUTE')) as signed_definers,
 (select count(*) from pg_proc x join pg_namespace n on n.oid=x.pronamespace
  where n.nspname='public' and x.prosecdef
  and has_function_privilege('anon',x.oid,'EXECUTE')) as anon_definers;

-- Review Supabase Auth leaked-password protection separately in Dashboard.
-- Do not replace service-only RLS tables with public policies to clear lints.
