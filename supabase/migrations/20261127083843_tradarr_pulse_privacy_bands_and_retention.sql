CREATE OR REPLACE FUNCTION public.tradarr_pulse_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); t text; lat double precision; lon double precision; radius numeric; result jsonb; today date:=(now() at time zone 'Europe/London')::date;
begin
 if actor is null or trade_private.tradarr_account_suspended(actor) or trade_private.tradarr_trade_paused(actor) then raise exception 'Active trade account required' using errcode='42501';end if;
 select p.primary_trade,a.work_area_latitude,a.work_area_longitude,least(50,greatest(1,coalesce(a.service_radius_miles,20))) into t,lat,lon,radius from public.tradesperson_profiles p left join public.trade_availability a on a.user_id=p.user_id where p.user_id=actor;
 if not found then raise exception 'Trade profile required' using errcode='42501';end if;
 if lat is null or lon is null then return jsonb_build_object('configured',false);end if;
 with jobs_all as (
 select id,customer_id,trade,latitude,longitude,status,created_at,completed_at,false urgent from public.jobs
 union all select id,customer_id,trade,latitude,longitude,status,created_at,case when status='completed' then updated_at end,true from public.urgent_requests
 ), local_jobs as (
 select * from jobs_all j where j.trade=t and j.customer_id<>actor and trade_private.pulse_real(j.customer_id) and trade_private.pulse_miles(lat,lon,j.latitude,j.longitude)<=radius and j.created_at>=now()-interval '30 days'
 ), local_searches as (
 select * from trade_private.pulse_events e where e.kind='search' and e.trade=t and e.actor_id<>actor and trade_private.pulse_real(e.actor_id) and e.event_day>=today-6 and trade_private.pulse_miles(lat,lon,e.cell_lat::double precision,e.cell_lon::double precision)<=radius
 ), activity as (
 select 'Job requests' label,count(*) n,count(distinct customer_id) people from local_jobs where created_at>=now()-interval '7 days'
 union all select 'Urgent requests',count(*),count(distinct customer_id) from local_jobs where urgent and created_at>=now()-interval '7 days'
 union all select 'Completed jobs',count(*),count(distinct customer_id) from local_jobs where status='completed' and completed_at>=now()-interval '7 days'
 ), cells as (
 select floor(latitude::numeric*10)/10+.05 clat,floor(longitude::numeric*10)/10+.05 clon,customer_id person from local_jobs where created_at>=now()-interval '7 days'
 union select cell_lat,cell_lon,actor_id from local_searches
 ), zones as (select clat,clon,count(distinct person) n from cells group by clat,clon having count(distinct person)>=5)
 select jsonb_build_object('configured',true,'trade',t,'radius',radius,'origin',jsonb_build_object('lat',round(lat::numeric,2),'lng',round(lon::numeric,2)),
 'searches',(select case when count(distinct actor_id)>=20 then '20+' when count(distinct actor_id)>=10 then '10–19' when count(distinct actor_id)>=5 then '5–9' end from local_searches),
 'activity',(select coalesce(jsonb_agg(jsonb_build_object('label',label,'count',case when n>=20 then '20+' when n>=10 then '10–19' else '5–9' end) order by label) filter(where people>=5),'[]'::jsonb) from activity),
 'zones',(select coalesce(jsonb_agg(jsonb_build_object('lat',clat,'lng',clon,'band',case when n>=20 then '20+' when n>=10 then '10–19' else '5–9' end)),'[]'::jsonb) from zones),
 'opportunities',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
 select j.id,o.summary,j.trade,j.timing,greatest(5,ceil(trade_private.pulse_miles(lat,lon,j.latitude,j.longitude)/5)*5) distance_miles, i.status interest_status,
 o.published_at from trade_private.pulse_open_jobs o join public.jobs j on j.id=o.job_id left join trade_private.pulse_interests i on i.job_id=j.id and i.trader_id=actor
 where trade_private.pulse_eligible(j.id,actor) and not exists(select 1 from public.job_offers f where f.job_id=j.id and f.tradesperson_id=actor) order by o.published_at desc limit 40) x),
 'reach',jsonb_build_object('profile_views',(select count(distinct actor_id) from trade_private.pulse_events e where e.kind='profile' and e.target_id=actor and e.event_day>=today-6 and trade_private.pulse_real(e.actor_id)),
 'saved',(select count(*) from public.saved_tradespeople s where s.tradesperson_id=actor and s.created_at>=now()-interval '7 days' and trade_private.pulse_real(s.customer_id) and s.customer_id<>actor),
 'enquiries',(select count(*) from public.conversations c where c.tradesperson_id=actor and c.created_at>=now()-interval '7 days' and trade_private.pulse_real(c.customer_id) and c.customer_id<>actor),
 'won',(select count(*) from public.jobs j where j.accepted_tradesperson_id=actor and j.accepted_at>=now()-interval '7 days' and trade_private.pulse_real(j.customer_id))+(select count(*) from public.urgent_requests j where j.accepted_tradesperson_id=actor and j.accepted_at>=now()-interval '7 days' and trade_private.pulse_real(j.customer_id))),
 'missed',(select count(*) from public.job_offers where tradesperson_id=actor and status='expired' and offered_at>=now()-interval '7 days')+(select count(*) from public.urgent_request_offers where tradesperson_id=actor and status='expired' and offered_at>=now()-interval '7 days'),
 'alerts',coalesce((select alerts from trade_private.pulse_preferences where user_id=actor),false),'updated_at',now()) into result;
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION trade_private.pulse_eligible(p_job uuid, p_trader uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.jobs j join trade_private.pulse_open_jobs o on o.job_id=j.id
 join public.tradesperson_profiles t on t.user_id=p_trader join public.trade_availability a on a.user_id=t.user_id
 where j.id=p_job and j.customer_id<>p_trader and (trade_private.pulse_real(j.customer_id) or not trade_private.pulse_real(p_trader)) and j.trade=t.primary_trade and j.job_mode='normal' and j.timing in ('Flexible','Scheduled')
 and j.status in ('posted','offered') and j.accepted_tradesperson_id is null and j.created_at>now()-interval '30 days'
 and (j.requested_end is null or j.requested_end>now()) and a.work_area_latitude is not null and a.work_area_longitude is not null
 and trade_private.pulse_miles(j.latitude,j.longitude,a.work_area_latitude,a.work_area_longitude)<=least(coalesce(j.search_radius_miles,10),coalesce(a.service_radius_miles,20))
 and not trade_private.crew_blocked(j.customer_id,p_trader) and not trade_private.tradarr_account_suspended(j.customer_id)
 and not trade_private.tradarr_account_suspended(p_trader) and not trade_private.tradarr_trade_paused(p_trader))
$function$
;
select cron.schedule('tradarr-pulse-retention','17 3 * * *',$job$delete from trade_private.pulse_events where event_day < (now() at time zone 'Europe/London')::date-35$job$);
