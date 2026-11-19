-- Admin analytics: source-aligned daily trends, cohorts, privacy-filtered rough geography.
create or replace function public.tradarr_admin_analytics(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_days int := greatest(7,least(coalesce(p_days,30),90)); v_start date; result jsonb;
begin
 if (select auth.uid()) is null or not (select trade_private.tradarr_staff_authorised()) then
  raise exception 'Staff MFA required' using errcode='42501';end if;
 v_start:=current_date-(v_days-1);
 with buckets as (
  select g::date as bucket_date from generate_series(v_start,current_date,interval '1 day') as g
 ), all_jobs as (
  select customer_id,accepted_tradesperson_id,status,trade,latitude,longitude,
   created_at,accepted_at,completed_at,updated_at from public.jobs
  union all
  select customer_id,accepted_tradesperson_id,status,trade,latitude,longitude,
   created_at,accepted_at,null::timestamptz,updated_at from public.urgent_requests
 ), daily as (
  select b.bucket_date as d,
   (select count(*) from auth.users u where u.created_at>=b.bucket_date and u.created_at<b.bucket_date+1) as registrations,
   (select count(*) from all_jobs j where j.created_at>=b.bucket_date and j.created_at<b.bucket_date+1) as jobs_posted,
   (select count(*) from all_jobs j where j.accepted_at>=b.bucket_date and j.accepted_at<b.bucket_date+1) as jobs_accepted,
   (select count(*) from all_jobs j where j.completed_at>=b.bucket_date and j.completed_at<b.bucket_date+1) as completed_standard_jobs,
   (select count(*) from public.trade_appointments a where a.starts_at>=b.bucket_date
     and a.starts_at<b.bucket_date+1 and a.status='completed') as completed_bookings,
   (select count(*) from public.trade_appointments a where a.updated_at>=b.bucket_date
     and a.updated_at<b.bucket_date+1 and a.status='cancelled') as cancelled_booking_last_updated
  from buckets b
 ), cohort as (
  select count(*) as total,
   count(*) filter(where accepted_at is not null or status in ('accepted','en_route','arrived','in_progress','completed')) as accepted,
   count(*) filter(where status='completed') as completed,
   count(*) filter(where status='cancelled') as cancelled,
   count(*) filter(where status='expired') as expired
  from all_jobs where created_at>=v_start
 ), geographical as (
  select round(j.latitude::numeric,1) as lat_band,
   round(j.longitude::numeric,1) as lon_band,count(*) as requests
  from all_jobs j where j.created_at>=v_start and j.latitude is not null and j.longitude is not null
  group by 1,2 having count(*)>=3 order by requests desc limit 12
 )
 select jsonb_build_object(
  'window_days',v_days,'generated_at',now(),
  'registrations',(select count(*) from auth.users where created_at>=v_start),
  'active_traders_30d',(select count(distinct active_id) from (
    select a.user_id as active_id from public.trade_availability a where a.is_available=true and (a.available_until is null or a.available_until>now())
    union
    select o.tradesperson_id from public.job_offers o where o.offered_at>=now()-interval '30 days'
    union
    select j.accepted_tradesperson_id from public.jobs j where j.accepted_at>=now()-interval '30 days'
   ) active where active_id is not null),
  'jobs_posted',(select total from cohort),
  'jobs_accepted',(select accepted from cohort),
  'jobs_completed_current',(select completed from cohort),
  'jobs_cancelled_current',(select cancelled from cohort),
  'jobs_expired_current',(select expired from cohort),
  'acceptance_rate_pct',(select case when total=0 then 0 else round(accepted::numeric*100/total,1) end from cohort),
  'completion_rate_pct',(select case when accepted=0 then 0 else round(completed::numeric*100/accepted,1) end from cohort),
  'cancellation_rate_pct',(select case when total=0 then 0 else round(cancelled::numeric*100/total,1) end from cohort),
  'completed_appointments',(select count(*) from public.trade_appointments a where a.status='completed' and a.starts_at>=v_start),
  'cancelled_appointments',(select count(*) from public.trade_appointments a where a.status='cancelled' and a.starts_at>=v_start),
  'quotes_delivered',(select count(*) from public.trade_customer_proposals p where p.delivered_at>=v_start),
  'quotes_accepted',(select count(*) from public.trade_customer_proposals p where p.decision='accepted' and p.delivered_at>=v_start),
  'quote_conversion_pct',(select coalesce(round(100.0*count(*) filter(where decision='accepted')/nullif(count(*),0),1),0)
   from public.trade_customer_proposals where delivered_at>=v_start),
  'trade_invoice_amount_gbp',(select coalesce(sum(i.total),0) from public.trade_invoices i
   where i.status in ('sent','paid') and i.created_at>=v_start),
  'platform_revenue_gbp',null,
  'series',(select coalesce(jsonb_agg(jsonb_build_object('day',d,'registrations',registrations,
    'jobs_posted',jobs_posted,'jobs_accepted',jobs_accepted,'completed_standard_jobs',completed_standard_jobs,
    'completed_bookings',completed_bookings,'cancelled_appointments_last_updated',cancelled_booking_last_updated)
    order by d),'[]'::jsonb) from daily),
  'geo_demand',(select coalesce(jsonb_agg(jsonb_build_object(
    'area',lat_band::text||'°, '||lon_band::text||'° (~11 km grid)',
    'requests',requests) order by requests desc),'[]'::jsonb) from geographical)
 ) into result;
 return result;
end $$;
revoke all on function public.tradarr_admin_analytics(integer) from public,anon;
grant execute on function public.tradarr_admin_analytics(integer) to authenticated;

-- Account event summary: does not claim to record logins or GPS history.
create or replace function public.tradarr_admin_account_activity(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not (select trade_private.tradarr_staff_authorised()) then
  raise exception 'Staff MFA required' using errcode='42501';end if;
 if p_user_id is null or not exists(select 1 from auth.users where id=p_user_id) then
  raise exception 'Account not found' using errcode='22023';end if;
 select jsonb_build_object(
  'jobs_posted',(select count(*) from public.jobs where customer_id=p_user_id),
  'urgent_requests',(select count(*) from public.urgent_requests where customer_id=p_user_id),
  'jobs_accepted',(select count(*) from public.jobs where accepted_tradesperson_id=p_user_id),
  'messages_sent',(select count(*) from public.messages where sender_id=p_user_id),
  'appointments',(select count(*) from public.trade_appointments where customer_id=p_user_id or tradesperson_id=p_user_id),
  'invoices_issued',(select count(*) from public.trade_invoices where tradesperson_id=p_user_id),
  'support_cases',(select count(*) from public.support_requests where submitted_by=p_user_id),
  'reports_filed',(select count(*) from public.tradarr_safety_reports where reporter_id=p_user_id),
  'last_message_at',(select max(created_at) from public.messages where sender_id=p_user_id),
  'last_job_at',(select max(created_at) from public.jobs where customer_id=p_user_id or accepted_tradesperson_id=p_user_id),
  'recent_events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.at desc),'[]'::jsonb)
   from (select created_at as at,'message_sent'::text as kind,null::uuid as job_id
    from public.messages where sender_id=p_user_id
    union all select created_at,'job_posted',id from public.jobs where customer_id=p_user_id
    union all select created_at,'urgent_requested',id from public.urgent_requests where customer_id=p_user_id
    union all select created_at,'appointment_created',id from public.trade_appointments
     where customer_id=p_user_id or tradesperson_id=p_user_id
    order by at desc limit 25) e)
 ) into result;
 return result;
end $$;
revoke all on function public.tradarr_admin_account_activity(uuid) from public,anon;
grant execute on function public.tradarr_admin_account_activity(uuid) to authenticated;
