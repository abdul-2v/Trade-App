-- All route requests use the same transaction and coarse matching coordinates.
create or replace function public.tradarr_post_flexible_job(p_trade text,p_issue text,p_mode text,p_deadline timestamptz,p_latitude double precision,p_longitude double precision,p_area_source text default 'postcode')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); jid uuid; cnt int; lat double precision; lon double precision;
begin
 if actor is null or trade_private.tradarr_account_suspended(actor) then raise exception 'Sign in with an active account' using errcode='42501';end if;
 if p_mode is null or p_mode not in ('on_my_way','street_run') or p_deadline is null or p_deadline<=now() or p_deadline>now()+interval '8 days' or char_length(btrim(coalesce(p_issue,''))) not between 3 and 1000 or p_latitude is null or p_latitude not between 49 and 61 or p_longitude is null or p_longitude not between -9 and 3 then raise exception 'Choose a valid journey, job and future deadline' using errcode='22023';end if;
 lat:=round(p_latitude::numeric,2)::double precision;lon:=round(p_longitude::numeric,2)::double precision;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,763202));
 select j.id into jid from public.jobs j join public.job_locations l on l.job_id=j.id
 where j.customer_id=actor and j.status in ('posted','offered') and j.created_at>now()-interval '2 minutes' and j.trade=p_trade and j.issue=btrim(p_issue)
 and j.job_mode=case when p_mode='street_run' then 'street_run' else 'route' end and abs(extract(epoch from j.flexible_deadline-p_deadline))<=120 and l.latitude=p_latitude and l.longitude=p_longitude order by j.created_at desc limit 1;
 if found then select count(*) into cnt from public.job_offers where job_id=jid;return jsonb_build_object('id',jid,'candidate_count',cnt);end if;
 if (select count(*) from public.jobs where customer_id=actor and created_at>now()-interval '1 hour')>=20 then raise exception 'Too many recent job requests' using errcode='22023';end if;
 insert into public.jobs(customer_id,trade,issue,job_mode,timing,latitude,longitude,location_label,search_radius_miles,flexible_deadline,status)
 values(actor,p_trade,btrim(p_issue),case when p_mode='street_run' then 'street_run' else 'route' end,'Flexible journey request',lat,lon,'Approximate requested area',15,p_deadline,'posted') returning id into jid;
 insert into public.job_locations(job_id,customer_id,latitude,longitude,address_label)
 values(jid,actor,p_latitude,p_longitude,case when p_area_source='phone' then 'Phone position approximation; confirm property address before visiting' else 'Postcode approximation; confirm property address before visiting' end);
 insert into public.job_offers(job_id,tradesperson_id,route_plan_id,distance_miles,status)
 select jid,p.tradesperson_id,p.id,round(p.dist::numeric,2),'offered' from (
  select distinct on (r.tradesperson_id) r.id,r.tradesperson_id,d.dist,r.starts_at
  from public.trade_route_plans r join public.trade_appointments a on a.id=r.anchor_appointment_id and a.tradesperson_id=r.tradesperson_id
  cross join lateral (select trade_private.tradarr_route_distance_miles(r.mode,r.start_latitude,r.start_longitude,r.end_latitude,r.end_longitude,lat,lon) as dist) d
  where r.tradesperson_id<>actor and r.trade=p_trade and r.mode=p_mode and r.status='open' and r.starts_at>now() and r.starts_at<=p_deadline and a.status='scheduled'
  and d.dist<=least(15,r.max_deviation_miles)
  and not trade_private.crew_blocked(actor,r.tradesperson_id) and not trade_private.tradarr_account_suspended(r.tradesperson_id) and not trade_private.tradarr_trade_paused(r.tradesperson_id)
  and (select count(*) from public.job_offers o join public.jobs j on j.id=o.job_id where o.route_plan_id=r.id and o.status='accepted' and j.status not in ('completed','cancelled','expired'))<r.max_extra_visits
  order by r.tradesperson_id,d.dist,r.starts_at,r.id
 ) p order by p.dist,p.starts_at,p.id limit 8;
 get diagnostics cnt=row_count;
 if cnt>0 then update public.jobs set status='offered',updated_at=now() where id=jid;end if;
 return jsonb_build_object('id',jid,'candidate_count',cnt);
end $$;
revoke all on function public.tradarr_post_flexible_job(text,text,text,timestamptz,double precision,double precision,text) from public,anon;
grant execute on function public.tradarr_post_flexible_job(text,text,text,timestamptz,double precision,double precision,text) to authenticated;

-- Later-published routes must honour the same safety and capacity rules.
create or replace function trade_private.tradarr_route_plan_posted_matches()
returns trigger language plpgsql security definer set search_path='' as $$
declare j record; dist double precision;
begin
 if new.status<>'open' or new.starts_at<=now() or trade_private.tradarr_account_suspended(new.tradesperson_id) or trade_private.tradarr_trade_paused(new.tradesperson_id) then return null;end if;
 if tg_op='UPDATE' and old.status='open' then return null;end if;
 for j in select id,customer_id,latitude,longitude,search_radius_miles from public.jobs
 where status in ('posted','offered') and accepted_tradesperson_id is null and trade=new.trade and job_mode=case when new.mode='street_run' then 'street_run' else 'route' end
 and flexible_deadline>=new.starts_at and latitude is not null and longitude is not null
 and customer_id<>new.tradesperson_id and not trade_private.crew_blocked(customer_id,new.tradesperson_id) and not trade_private.tradarr_account_suspended(customer_id)
 for update
 loop
  dist:=trade_private.tradarr_route_distance_miles(new.mode,new.start_latitude,new.start_longitude,new.end_latitude,new.end_longitude,j.latitude,j.longitude);
  if dist<=new.max_deviation_miles and dist<=j.search_radius_miles and (select count(*) from public.job_offers where job_id=j.id and status='offered')<8 then
   insert into public.job_offers(job_id,tradesperson_id,distance_miles,route_plan_id,status) values(j.id,new.tradesperson_id,round(dist::numeric,2),new.id,'offered') on conflict do nothing;
   update public.jobs set status='offered',updated_at=now() where id=j.id and status='posted' and exists(select 1 from public.job_offers where job_id=j.id and status='offered');
  end if;
 end loop;
 return null;
end $$;
revoke all on function trade_private.tradarr_route_plan_posted_matches() from public,anon,authenticated;
