-- Tradarr Pulse: private, deduplicated demand analytics and opt-in opportunities.
create table trade_private.pulse_excluded_accounts(user_id uuid primary key references auth.users(id) on delete cascade);
create table trade_private.pulse_events(
 actor_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('search','profile')),
 trade text not null, target_id uuid references auth.users(id) on delete cascade,
 cell_lat numeric not null,cell_lon numeric not null, event_day date not null,
 created_at timestamptz not null default now()
);
create unique index pulse_event_unique on trade_private.pulse_events(actor_id,kind,trade,coalesce(target_id,'00000000-0000-0000-0000-000000000000'::uuid),cell_lat,cell_lon,event_day);
create index pulse_event_area on trade_private.pulse_events(trade,event_day,cell_lat,cell_lon);
create index pulse_event_target on trade_private.pulse_events(target_id,event_day);
create table trade_private.pulse_open_jobs(job_id uuid primary key references public.jobs(id) on delete cascade, summary text not null check(char_length(summary) between 5 and 140), published_at timestamptz not null default now());
create table trade_private.pulse_interests(job_id uuid not null references public.jobs(id) on delete cascade, trader_id uuid not null references auth.users(id) on delete cascade, status text not null default 'pending' check(status in ('pending','invited','withdrawn','declined')), created_at timestamptz not null default now(),primary key(job_id,trader_id));
create index pulse_interests_trader on trade_private.pulse_interests(trader_id,created_at);
create table trade_private.pulse_preferences(user_id uuid primary key references auth.users(id) on delete cascade, alerts boolean not null default false);
alter table trade_private.pulse_events enable row level security;
alter table trade_private.pulse_open_jobs enable row level security;
alter table trade_private.pulse_interests enable row level security;
alter table trade_private.pulse_preferences enable row level security;
alter table trade_private.pulse_excluded_accounts enable row level security;
revoke all on trade_private.pulse_events,trade_private.pulse_open_jobs,trade_private.pulse_interests,trade_private.pulse_preferences,trade_private.pulse_excluded_accounts from public,anon,authenticated;
create function trade_private.pulse_real(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_id and not coalesce(u.is_anonymous,false)
 and coalesce(u.raw_app_meta_data->>'tradarr_staff','false')<>'true'
 and not exists(select 1 from trade_private.pulse_excluded_accounts e where e.user_id=u.id))
$$;
create function trade_private.pulse_miles(a double precision,b double precision,c double precision,d double precision) returns double precision language sql immutable set search_path='' as $$
 select 3958.76*2*asin(sqrt(least(1.0,greatest(0.0,power(sin(radians(c-a)/2),2)+cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2)))))
$$;
create function public.tradarr_pulse_record(p_kind text,p_trade text,p_lat double precision default null,p_lon double precision default null,p_target uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); lat double precision:=p_lat; lon double precision:=p_lon; t text:=p_trade;
begin
 if actor is null or not trade_private.pulse_real(actor) or trade_private.tradarr_account_suspended(actor) then return;end if;
 if p_kind='profile' then
  if p_target is null or p_target=actor or not trade_private.pulse_real(p_target) or trade_private.crew_blocked(actor,p_target) then return;end if;
  select tp.primary_trade,a.work_area_latitude,a.work_area_longitude into t,lat,lon from public.tradesperson_profiles tp left join public.trade_availability a on a.user_id=tp.user_id where tp.user_id=p_target;
  if not found then return;end if;
 elsif p_kind='search' then
  if p_target is not null then return;end if;
 else return;end if;
 if t is null or t not in ('Plumber','Electrician','Builder','Heating','Locksmith','Carpenter','Roofer') or lat is null or lon is null or lat not between 49 and 61 or lon not between -9 and 3 then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,78122));
 if (select count(*) from trade_private.pulse_events where actor_id=actor and event_day=(now() at time zone 'Europe/London')::date)>=60 then return;end if;
 insert into trade_private.pulse_events(actor_id,kind,trade,target_id,cell_lat,cell_lon,event_day)
 values(actor,p_kind,t,p_target,floor(lat::numeric*10)/10+.05,floor(lon::numeric*10)/10+.05,(now() at time zone 'Europe/London')::date) on conflict do nothing;
end $$;
-- Shared eligibility: normal non-urgent jobs only, saved work area and service radius.
create function trade_private.pulse_eligible(p_job uuid,p_trader uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.jobs j join trade_private.pulse_open_jobs o on o.job_id=j.id
 join public.tradesperson_profiles t on t.user_id=p_trader join public.trade_availability a on a.user_id=t.user_id
 where j.id=p_job and j.customer_id<>p_trader and j.trade=t.primary_trade and j.job_mode='normal' and j.timing in ('Flexible','Scheduled')
 and j.status in ('posted','offered') and j.accepted_tradesperson_id is null and j.created_at>now()-interval '30 days'
 and (j.requested_end is null or j.requested_end>now()) and a.work_area_latitude is not null and a.work_area_longitude is not null
 and trade_private.pulse_miles(j.latitude,j.longitude,a.work_area_latitude,a.work_area_longitude)<=least(coalesce(j.search_radius_miles,10),coalesce(a.service_radius_miles,20))
 and not trade_private.crew_blocked(j.customer_id,p_trader) and not trade_private.tradarr_account_suspended(j.customer_id)
 and not trade_private.tradarr_account_suspended(p_trader) and not trade_private.tradarr_trade_paused(p_trader))
$$;
create function public.tradarr_pulse_publish(p_job uuid,p_summary text default null) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); j public.jobs%rowtype;
begin
 select * into j from public.jobs where id=p_job and customer_id=actor for update;
 if not found or actor is null or trade_private.tradarr_account_suspended(actor) then raise exception 'Request not available' using errcode='42501';end if;
 if p_summary is null then delete from trade_private.pulse_open_jobs where job_id=p_job;update trade_private.pulse_interests set status='declined' where job_id=p_job and status='pending';return;end if;
 if j.job_mode<>'normal' or j.timing not in ('Flexible','Scheduled') or j.status not in ('posted','offered') or j.accepted_tradesperson_id is not null then raise exception 'Only open standard jobs can be shared';end if;
 if char_length(btrim(p_summary)) not between 5 and 140 or p_summary ~ '[0-9]{3,}' or p_summary ~ '@|https?://' then raise exception 'Use a short work summary without contact details or addresses';end if;
 insert into trade_private.pulse_open_jobs(job_id,summary) values(p_job,btrim(p_summary)) on conflict(job_id) do update set summary=excluded.summary;
end $$;
create function public.tradarr_pulse_customer(p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null or not exists(select 1 from public.jobs where id=p_job and customer_id=actor) or trade_private.tradarr_account_suspended(actor) then raise exception 'Request not available' using errcode='42501';end if;
 select jsonb_build_object('summary',(select summary from trade_private.pulse_open_jobs where job_id=p_job),'interests',coalesce((select jsonb_agg(jsonb_build_object('trader_id',i.trader_id,'name',t.display_name,'status',i.status,'created_at',i.created_at) order by i.created_at desc) from trade_private.pulse_interests i join public.tradesperson_profiles t on t.user_id=i.trader_id where i.job_id=p_job and not trade_private.crew_blocked(actor,i.trader_id) and not trade_private.tradarr_account_suspended(i.trader_id)),'[]'::jsonb)) into result;
 return result;
end $$;
create function public.tradarr_pulse_interest(p_job uuid,p_withdraw boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); j public.jobs%rowtype; changed int;
begin
 if actor is null then raise exception 'Sign in' using errcode='42501';end if;
 select * into j from public.jobs where id=p_job for update;
 if p_withdraw then update trade_private.pulse_interests set status='withdrawn' where job_id=p_job and trader_id=actor and status='pending';return;end if;
 if not trade_private.pulse_eligible(p_job,actor) then raise exception 'This opportunity is no longer available' using errcode='42501';end if;
 if exists(select 1 from public.job_offers where job_id=p_job and tradesperson_id=actor) then raise exception 'Check your existing invitations';end if;
 if (select count(*) from trade_private.pulse_interests where job_id=p_job and status='pending')>=20 then raise exception 'This request has enough responses for now';end if;
 if (select count(*) from trade_private.pulse_interests where trader_id=actor and created_at>now()-interval '1 day')>=25 then raise exception 'Daily interest limit reached';end if;
 insert into trade_private.pulse_interests(job_id,trader_id) values(p_job,actor) on conflict do nothing;
 get diagnostics changed=row_count;
 if changed>0 then
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data) values(j.customer_id,'pulse-interest:'||p_job||':'||actor,'job_status','A local tradesperson is interested','Review interest in your job request.',jsonb_build_object('screen','requests','jobId',p_job)) on conflict(recipient_id,event_key) do nothing;
 end if;
end $$;
create function public.tradarr_pulse_decide(p_job uuid,p_trader uuid,p_invite boolean) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); j public.jobs%rowtype; distance numeric;
begin
 select * into j from public.jobs where id=p_job and customer_id=actor for update;
 if not found or actor is null or trade_private.tradarr_account_suspended(actor) or not exists(select 1 from trade_private.pulse_interests where job_id=p_job and trader_id=p_trader and status='pending') then raise exception 'Interest no longer available' using errcode='42501';end if;
 if p_invite then
  if not trade_private.pulse_eligible(p_job,p_trader) then raise exception 'This tradesperson is no longer eligible';end if;
  select round(trade_private.pulse_miles(j.latitude,j.longitude,a.work_area_latitude,a.work_area_longitude)::numeric,2) into distance from public.trade_availability a where a.user_id=p_trader;
  insert into public.job_offers(job_id,tradesperson_id,distance_miles,status) values(p_job,p_trader,distance,'offered') on conflict do nothing;
  if not exists(select 1 from public.job_offers where job_id=p_job and tradesperson_id=p_trader and status='offered') then raise exception 'An invitation already exists';end if;
  update public.jobs set status='offered',updated_at=now() where id=p_job and status='posted';
 end if;
 update trade_private.pulse_interests set status=case when p_invite then 'invited' else 'declined' end where job_id=p_job and trader_id=p_trader;
end $$;
create function public.tradarr_pulse_alerts(p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.tradesperson_profiles where user_id=auth.uid()) or trade_private.tradarr_account_suspended(auth.uid()) then raise exception 'Trade profile required' using errcode='42501';end if;
 insert into trade_private.pulse_preferences(user_id,alerts) values(auth.uid(),coalesce(p_enabled,false)) on conflict(user_id) do update set alerts=excluded.alerts;
end $$;
create function trade_private.pulse_notify_open() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 select p.user_id,'pulse-opportunity:'||new.job_id,'job_status','New local opportunity','A customer has shared a job in your work area.',jsonb_build_object('screen','tradeJobs')
 from trade_private.pulse_preferences p where p.alerts and trade_private.pulse_eligible(new.job_id,p.user_id)
 and not exists(select 1 from public.tradarr_notifications n where n.recipient_id=p.user_id and n.event_key like 'pulse-opportunity:%' and n.created_at>now()-interval '1 hour')
 limit 200 on conflict(recipient_id,event_key) do nothing;
 return null;
end $$;
create trigger pulse_notify_open after insert on trade_private.pulse_open_jobs for each row execute function trade_private.pulse_notify_open();
-- Fixed work-area scope, aggregate only, suppress small cohorts; no individual browsing feed.
create function public.tradarr_pulse_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
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
 'searches',(select case when count(distinct actor_id)>=5 then count(distinct actor_id) end from local_searches),
 'activity',(select coalesce(jsonb_agg(jsonb_build_object('label',label,'count',n) order by label) filter(where people>=5),'[]'::jsonb) from activity),
 'zones',(select coalesce(jsonb_agg(jsonb_build_object('lat',clat,'lng',clon,'band',case when n>=20 then '20+' when n>=10 then '10–19' else '5–9' end)),'[]'::jsonb) from zones),
 'opportunities',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
 select j.id,o.summary,j.trade,j.timing,round(trade_private.pulse_miles(lat,lon,j.latitude,j.longitude)::numeric) distance_miles, i.status interest_status,
 o.published_at from trade_private.pulse_open_jobs o join public.jobs j on j.id=o.job_id left join trade_private.pulse_interests i on i.job_id=j.id and i.trader_id=actor
 where trade_private.pulse_eligible(j.id,actor) and not exists(select 1 from public.job_offers f where f.job_id=j.id and f.tradesperson_id=actor) order by o.published_at desc limit 40) x),
 'reach',jsonb_build_object('profile_views',(select count(distinct actor_id) from trade_private.pulse_events e where e.kind='profile' and e.target_id=actor and e.event_day>=today-6 and trade_private.pulse_real(e.actor_id)),
 'saved',(select count(*) from public.saved_tradespeople s where s.tradesperson_id=actor and s.created_at>=now()-interval '7 days' and trade_private.pulse_real(s.customer_id) and s.customer_id<>actor),
 'enquiries',(select count(*) from public.conversations c where c.tradesperson_id=actor and c.created_at>=now()-interval '7 days' and trade_private.pulse_real(c.customer_id) and c.customer_id<>actor),
 'won',(select count(*) from public.jobs j where j.accepted_tradesperson_id=actor and j.accepted_at>=now()-interval '7 days' and trade_private.pulse_real(j.customer_id))+(select count(*) from public.urgent_requests j where j.accepted_tradesperson_id=actor and j.accepted_at>=now()-interval '7 days' and trade_private.pulse_real(j.customer_id))),
 'missed',(select count(*) from public.job_offers where tradesperson_id=actor and status='expired' and offered_at>=now()-interval '7 days')+(select count(*) from public.urgent_request_offers where tradesperson_id=actor and status='expired' and offered_at>=now()-interval '7 days'),
 'alerts',coalesce((select alerts from trade_private.pulse_preferences where user_id=actor),false),'updated_at',now()) into result;
 return result;
end $$;
-- Revoke default callable privileges; only authenticated RPCs are exposed.
do $$ declare r record;begin
 for r in select p.oid::regprocedure fn,n.nspname schema_name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname like 'tradarr_pulse_%') or (n.nspname='trade_private' and p.proname like 'pulse_%') loop
 execute format('revoke all on function %s from public,anon,authenticated',r.fn);
 if r.schema_name='public' then execute format('grant execute on function %s to authenticated',r.fn);end if;
 end loop;
end $$;
