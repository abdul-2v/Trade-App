-- Atomic cross-platform request creation and safe job edits.
create or replace function public.tradarr_dispatch_urgent(p_trade text,p_issue text,p_urgency text,p_latitude double precision,p_longitude double precision,p_radius numeric default 10)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); rid uuid; candidate_count int; candidates jsonb;
begin
 if actor is null or trade_private.tradarr_account_suspended(actor) then raise exception 'Sign in with an active account' using errcode='42501'; end if;
 if p_trade is null or p_trade not in ('Plumber','Electrician','Builder','Heating','Locksmith','Carpenter','Roofer') or char_length(btrim(coalesce(p_issue,''))) not between 3 and 1000 or p_urgency is null or p_urgency not in ('ASAP','Today','This week') or p_latitude is null or p_latitude not between 49 and 61 or p_longitude is null or p_longitude not between -9 and 3 or p_radius is null or p_radius not between 1 and 50 then raise exception 'Choose a trade, urgency and valid UK location' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,763201));
 -- Retry an identical still-searching request without sending duplicate invitations.
 select u.id into rid from public.urgent_requests u join public.urgent_request_locations l on l.request_id=u.id
 where u.customer_id=actor and u.status='searching' and u.created_at>now()-interval '2 minutes' and u.trade=p_trade and u.issue=btrim(p_issue) and u.urgency=p_urgency and l.latitude=p_latitude and l.longitude=p_longitude and u.search_radius_miles=p_radius order by u.created_at desc limit 1;
 if found then select count(*) into candidate_count from public.urgent_request_offers where request_id=rid; return jsonb_build_object('id',rid,'candidate_count',candidate_count); end if;
 if (select count(*) from public.urgent_requests where customer_id=actor and created_at>now()-interval '1 hour')>=10 then raise exception 'Too many recent requests. Please wait before posting again.' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into candidates from (
 select t.user_id, d.miles, greatest(8,least(60,round(7+d.miles*4)::int)) as eta
 from public.tradesperson_profiles t join public.trade_availability a on a.user_id=t.user_id
 left join public.trade_map_presence m on m.user_id=t.user_id
 cross join lateral (select coalesce(m.source_mode='live' and a.location_mode='live' and m.updated_at between now()-interval '10 minutes' and now() and m.latitude is not null and m.longitude is not null,false) as fresh) f
 cross join lateral (select case when f.fresh then m.latitude else a.work_area_latitude end as lat,case when f.fresh then m.longitude else a.work_area_longitude end as lon) pos
 cross join lateral (select 3958.76*2*asin(sqrt(least(1.0,greatest(0.0,power(sin(radians(pos.lat-p_latitude)/2),2)+cos(radians(p_latitude))*cos(radians(pos.lat))*power(sin(radians(pos.lon-p_longitude)/2),2))))) as miles,
 3958.76*2*asin(sqrt(least(1.0,greatest(0.0,power(sin(radians(a.work_area_latitude-p_latitude)/2),2)+cos(radians(p_latitude))*cos(radians(a.work_area_latitude))*power(sin(radians(a.work_area_longitude-p_longitude)/2),2))))) as coverage) d
 where t.user_id<>actor and t.primary_trade=p_trade and a.is_available and a.emergency_opt_in and (a.available_until is null or a.available_until>now())
 and a.work_area_latitude is not null and a.work_area_longitude is not null
 and d.coverage<=greatest(1,least(50,coalesce(a.service_radius_miles,20)))+0.6 and d.miles<=least(p_radius,coalesce(a.radius_miles,10))
 and not trade_private.crew_blocked(actor,t.user_id) and not trade_private.tradarr_account_suspended(t.user_id) and not trade_private.tradarr_trade_paused(t.user_id)
 order by f.fresh desc,d.miles,t.user_id limit 8
 ) q;
 candidate_count:=jsonb_array_length(candidates);
 if candidate_count=0 then return jsonb_build_object('id',null,'candidate_count',0); end if;
 insert into public.urgent_requests(customer_id,trade,issue,urgency,latitude,longitude,location_label,search_radius_miles,status)
 values(actor,p_trade,btrim(p_issue),p_urgency,p_latitude,p_longitude,'Approximate job area',p_radius,'searching') returning id into rid;
 insert into public.urgent_request_locations(request_id,customer_id,latitude,longitude) values(rid,actor,p_latitude,p_longitude);
 insert into public.urgent_request_offers(request_id,tradesperson_id,distance_miles,eta_minutes,status)
 select rid,c.user_id,round(c.miles::numeric,2),c.eta,'offered' from jsonb_to_recordset(candidates) c(user_id uuid,miles double precision,eta int);
 return jsonb_build_object('id',rid,'candidate_count',candidate_count);
end $$;
revoke all on function public.tradarr_dispatch_urgent(text,text,text,double precision,double precision,numeric) from public,anon;
grant execute on function public.tradarr_dispatch_urgent(text,text,text,double precision,double precision,numeric) to authenticated;

create or replace function public.tradarr_post_standard_job(p_trade text,p_issue text,p_postcode text,p_latitude double precision,p_longitude double precision,p_radius numeric,p_timing text,p_requested_start timestamptz default null,p_requested_end timestamptz default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); jid uuid; pc text:=upper(btrim(coalesce(p_postcode,'')));
begin
 if actor is null or trade_private.tradarr_account_suspended(actor) then raise exception 'Sign in with an active account' using errcode='42501'; end if;
 if pc !~ '^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2}$' or p_latitude is null or p_latitude not between 49 and 61 or p_longitude is null or p_longitude not between -9 and 3 or char_length(btrim(coalesce(p_issue,''))) not between 3 and 1000 or p_radius is null or p_radius not between 1 and 50 or p_timing is null or p_timing not in ('Flexible','Scheduled','ASAP') then raise exception 'Invalid job details' using errcode='22023';end if;
 if p_timing='Scheduled' then
  if p_requested_start is null or p_requested_end is null or p_requested_start<now()+interval '15 minutes' or p_requested_end<>p_requested_start+interval '2 hours' then raise exception 'Choose a future two-hour booking window' using errcode='22023';end if;
 elsif p_requested_start is not null or p_requested_end is not null then raise exception 'Unexpected booking window' using errcode='22023';end if;
 insert into public.jobs(customer_id,trade,issue,job_mode,timing,latitude,longitude,location_label,search_radius_miles,status,requested_start,requested_end)
 values(actor,p_trade,btrim(p_issue),'normal',p_timing,p_latitude,p_longitude,split_part(pc,' ',1),p_radius,'posted',p_requested_start,p_requested_end) returning id into jid;
 insert into public.job_locations(job_id,customer_id,latitude,longitude,address_label) values(jid,actor,p_latitude,p_longitude,pc);
 return jid;
end $$;
revoke all on function public.tradarr_post_standard_job(text,text,text,double precision,double precision,numeric,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.tradarr_post_standard_job(text,text,text,double precision,double precision,numeric,text,timestamptz,timestamptz) to authenticated;

create or replace function public.tradarr_customer_edit_uninvited_job(p_job_id uuid,p_issue text,p_location_label text,p_latitude double precision,p_longitude double precision,p_timing text,p_requested_start timestamptz,p_requested_end timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); pc text:=upper(btrim(coalesce(p_location_label,'')));
begin
 if actor is null or trade_private.tradarr_account_suspended(actor) then raise exception 'Sign in with an active account' using errcode='42501';end if;
 if p_job_id is null or char_length(btrim(coalesce(p_issue,''))) not between 17 and 1000 or pc !~ '^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2}$' or p_latitude is null or p_latitude not between 49 and 61 or p_longitude is null or p_longitude not between -9 and 3 or p_timing is null or p_timing not in ('ASAP','Flexible','Scheduled') then raise exception 'Enter valid job details' using errcode='22023';end if;
 if p_timing='Scheduled' then
  if p_requested_start is null or p_requested_end is null or p_requested_start<now()+interval '15 minutes' or p_requested_end<>p_requested_start+interval '2 hours' then raise exception 'Choose a future two-hour booking window' using errcode='22023';end if;
 elsif p_requested_start is not null or p_requested_end is not null then raise exception 'Unexpected booking window' using errcode='22023';end if;
 perform 1 from public.jobs where id=p_job_id and customer_id=actor and job_mode='normal' and status='posted' and accepted_tradesperson_id is null for update;
 if not found or exists(select 1 from public.job_offers where job_id=p_job_id) then raise exception 'This job cannot be edited after invitations have been sent. Cancel and repost.' using errcode='42501';end if;
 update public.jobs set issue=btrim(p_issue),location_label=split_part(pc,' ',1),latitude=p_latitude,longitude=p_longitude,timing=p_timing,requested_start=p_requested_start,requested_end=p_requested_end,updated_at=now() where id=p_job_id;
 insert into public.job_locations(job_id,customer_id,latitude,longitude,address_label) values(p_job_id,actor,p_latitude,p_longitude,pc)
 on conflict(job_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,address_label=excluded.address_label where job_locations.customer_id=actor;
 if not found then raise exception 'Location owner mismatch' using errcode='42501';end if;
 return p_job_id;
end $$;
revoke all on function public.tradarr_customer_edit_uninvited_job(uuid,text,text,double precision,double precision,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.tradarr_customer_edit_uninvited_job(uuid,text,text,double precision,double precision,text,timestamptz,timestamptz) to authenticated;

-- Extend the existing scheduled reminder worker, without creating duplicate cron jobs.
create or replace function trade_private.tradarr_send_appointment_reminders()
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.jobs set status='expired',updated_at=now() where status in ('posted','offered') and accepted_tradesperson_id is null and (flexible_deadline<=now() or requested_end<=now());
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 select distinct person.recipient_id,'appointment-reminder:'||a.id||':'||rw.label||':'||extract(epoch from a.starts_at)::bigint,
 'appointment_reminder',case rw.label when '24h' then 'Booking tomorrow' else 'Appointment coming up' end,
 case rw.label when '24h' then 'Your confirmed Tradarr appointment is tomorrow.' else 'Your confirmed Tradarr appointment starts in around one hour.' end,
 jsonb_build_object('screen',case when person.recipient_id=coalesce(j.customer_id,g.customer_id,a.customer_id) then 'requests' else 'tradeDiary' end,'jobId',j.id,'appointmentId',a.id,'gridRequestId',g.id)
 from public.trade_appointments a left join public.jobs j on j.id=a.job_id left join public.trade_grid_requests g on g.id=a.grid_request_id
 cross join lateral (values ('24h',interval '23 hours 50 minutes',interval '24 hours 5 minutes'),('1h',interval '45 minutes',interval '65 minutes')) rw(label,lower_bound,upper_bound)
 cross join lateral (values (coalesce(j.customer_id,g.customer_id,a.customer_id)),(a.tradesperson_id)) person(recipient_id)
 where a.status='scheduled' and a.starts_at>now() and (a.job_id is null or j.status in ('accepted','en_route','arrived')) and (a.grid_request_id is null or g.status='accepted')
 and a.starts_at between now()+rw.lower_bound and now()+rw.upper_bound and person.recipient_id is not null
 on conflict(recipient_id,event_key) do nothing;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 select r.tradesperson_id,'business-reminder:'||r.id||':'||r.due_on,'appointment_reminder','Business reminder due','Open Tradarr to review your due reminder.',jsonb_build_object('screen','tradeDiary','reminderId',r.id)
 from public.trade_suite_reminders r where r.status='due' and r.due_on<=(now() at time zone 'Europe/London')::date and not trade_private.tradarr_account_suspended(r.tradesperson_id)
 on conflict(recipient_id,event_key) do nothing;
end $$;
revoke all on function trade_private.tradarr_send_appointment_reminders() from public,anon,authenticated;
