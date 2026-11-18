
alter table public.jobs add column if not exists flexible_deadline timestamptz;
alter table public.job_offers add column if not exists route_plan_id uuid;

create table if not exists public.trade_route_plans (
 id uuid primary key default gen_random_uuid(),
 tradesperson_id uuid not null references public.profiles(id) on delete cascade,
 anchor_appointment_id uuid not null references public.trade_appointments(id) on delete cascade,
 mode text not null check (mode in ('on_my_way','street_run')),
 trade text not null,
 start_area text not null,
 end_area text not null,
 start_latitude double precision not null,
 start_longitude double precision not null,
 end_latitude double precision not null,
 end_longitude double precision not null,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 max_deviation_miles numeric(5,2) not null default 3
    check (max_deviation_miles between 0.5 and 10),
 max_extra_visits int not null default 1
    check (max_extra_visits between 1 and 4),
 status text not null default 'open'
    check (status in ('open','paused','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint tradarr_route_plan_window_valid check
   (ends_at > starts_at and ends_at <= starts_at + interval '8 hours')
);
create index if not exists tradarr_open_route_plan_trade_idx
 on public.trade_route_plans(mode,trade,starts_at) where status='open';
alter table public.trade_route_plans enable row level security;

drop policy if exists tradarr_route_plans_read on public.trade_route_plans;
create policy tradarr_route_plans_read on public.trade_route_plans
 for select to authenticated using (
  tradesperson_id=(select auth.uid())
  or (status='open' and starts_at>now() and ends_at>now())
 );
drop policy if exists tradarr_route_plans_insert on public.trade_route_plans;
create policy tradarr_route_plans_insert on public.trade_route_plans
 for insert to authenticated with check (
  tradesperson_id=(select auth.uid()) and status='open'
  and starts_at>now() and starts_at<now()+interval '30 days'
  and exists(select 1 from public.trade_appointments a
     where a.id=anchor_appointment_id
     and a.tradesperson_id=(select auth.uid())
     and a.status='scheduled'
     and abs(extract(epoch from (starts_at-a.starts_at))) < 86400)
 );
drop policy if exists tradarr_route_plans_update on public.trade_route_plans;
create policy tradarr_route_plans_update on public.trade_route_plans
 for update to authenticated using(tradesperson_id=(select auth.uid()))
 with check(tradesperson_id=(select auth.uid()));
grant select,insert,update on public.trade_route_plans to authenticated;

alter table public.job_offers
 add constraint tradarr_offer_route_plan_fkey foreign key(route_plan_id)
 references public.trade_route_plans(id) on delete set null;
create index if not exists tradarr_route_offer_plan_idx
 on public.job_offers(route_plan_id,status) where route_plan_id is not null;

create or replace function trade_private.tradarr_route_distance_miles(
 p_mode text,a_lat double precision,a_lon double precision,
 b_lat double precision,b_lon double precision,p_lat double precision,p_lon double precision
) returns double precision language plpgsql immutable set search_path='' as $$
declare dy double precision; dx double precision;
        px double precision; py double precision; ratio double precision;
        lon_scale double precision;
begin
 lon_scale:=69.05*cos(radians((a_lat+b_lat+p_lat)/3));
 if p_mode='street_run' then
   return sqrt(power((p_lon-b_lon)*lon_scale,2)+power((p_lat-b_lat)*69.05,2));
 end if;
 dx:=(b_lon-a_lon)*lon_scale;dy:=(b_lat-a_lat)*69.05;
 px:=(p_lon-a_lon)*lon_scale;py:=(p_lat-a_lat)*69.05;
 if (dx*dx+dy*dy)<0.000000001 then ratio:=0;
 else ratio:=greatest(0,least(1,(px*dx+py*dy)/(dx*dx+dy*dy))); end if;
 return sqrt(power(px-ratio*dx,2)+power(py-ratio*dy,2));
end $$;

create or replace function trade_private.tradarr_guard_route_plan()
returns trigger language plpgsql set search_path='' as $$
declare ap record;
begin
 if new.starts_at <= now() or new.ends_at <= new.starts_at or new.ends_at > new.starts_at+interval '8 hours' then
   raise exception 'Route times must be a future window of eight hours or less' using errcode='22023';
 end if;
 if tg_op='UPDATE' and old.status='closed' and new.status<>'closed' then
   raise exception 'Create a new route for a closed journey' using errcode='23514';
 end if;
 select id,starts_at,status into ap from public.trade_appointments
  where id=new.anchor_appointment_id and tradesperson_id=new.tradesperson_id;
 if not found or ap.status<>'scheduled' or
    abs(extract(epoch from (ap.starts_at-new.starts_at)))>=86400 then
   raise exception 'A published journey must be linked to your confirmed upcoming diary appointment' using errcode='23514';
 end if;
 new.start_latitude:=round(new.start_latitude::numeric,2)::double precision;
 new.start_longitude:=round(new.start_longitude::numeric,2)::double precision;
 new.end_latitude:=round(new.end_latitude::numeric,2)::double precision;
 new.end_longitude:=round(new.end_longitude::numeric,2)::double precision;
 new.updated_at:=now();
 return new;
end $$;
drop trigger if exists tradarr_route_plan_guard on public.trade_route_plans;
create trigger tradarr_route_plan_guard before insert or update on public.trade_route_plans
for each row execute function trade_private.tradarr_guard_route_plan();

-- Prevent accepting a cancelled/filled or mismatched journey. FOR UPDATE serialises
-- simultaneous accepts so "1 extra visit" cannot become two on competing phones.
create or replace function trade_private.tradarr_route_offer_guard()
returns trigger language plpgsql set search_path='' as $$
declare plan record;job record;occupied int;distance double precision;
begin
 if tg_op='INSERT' and new.route_plan_id is not null then
   select * into plan from public.trade_route_plans where id=new.route_plan_id;
   select id,trade,job_mode,latitude,longitude,flexible_deadline
     into job from public.jobs where id=new.job_id;
   if not found or plan.id is null or plan.tradesperson_id<>new.tradesperson_id
     or plan.status<>'open' or plan.starts_at<=now()
     or job.trade<>plan.trade or
     (job.job_mode='route' and plan.mode<>'on_my_way') or
     (job.job_mode='street_run' and plan.mode<>'street_run') or
     job.job_mode not in ('route','street_run') or
     job.flexible_deadline is null or plan.starts_at>job.flexible_deadline then
      raise exception 'This journey is not eligible for the posted job' using errcode='23514';
   end if;
   distance:=trade_private.tradarr_route_distance_miles(
      plan.mode,plan.start_latitude,plan.start_longitude,
      plan.end_latitude,plan.end_longitude,job.latitude,job.longitude);
   if job.latitude is null or job.longitude is null or distance>plan.max_deviation_miles then
      raise exception 'The job is outside this journey corridor' using errcode='23514';
   end if;
 end if;
 if tg_op='UPDATE' and new.status='accepted' and old.status is distinct from 'accepted'
    and old.route_plan_id is not null then
   select * into plan from public.trade_route_plans where id=old.route_plan_id for update;
   if not found or plan.status<>'open' or plan.ends_at<=now() then
     raise exception 'This journey has expired or is no longer accepting visits' using errcode='23514';
   end if;
   select count(*) into occupied from public.job_offers o join public.jobs j on j.id=o.job_id
    where o.route_plan_id=old.route_plan_id and o.status='accepted'
      and j.status not in ('cancelled','completed');
   if occupied>=plan.max_extra_visits then
     raise exception 'This journey has reached its maximum extra visits' using errcode='23P01';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists tradarr_route_offer_guard on public.job_offers;
create trigger tradarr_route_offer_guard before insert or update of status
on public.job_offers for each row execute function trade_private.tradarr_route_offer_guard();

-- When a professional publishes a genuine diary-linked journey, find previously
-- posted requests that fit. Publish only a potential offer, never a confirmed booking.
create or replace function trade_private.tradarr_route_plan_posted_matches()
returns trigger language plpgsql security definer set search_path='' as $$
declare j record; dist double precision;
begin
 if new.status<>'open' or new.starts_at<=now() then return null; end if;
 if tg_op='UPDATE' and old.status='open' then return null; end if;
 for j in select id,trade,job_mode,latitude,longitude,search_radius_miles,
        flexible_deadline from public.jobs
   where status='posted' and accepted_tradesperson_id is null
     and trade=new.trade
     and job_mode=case when new.mode='street_run' then 'street_run' else 'route' end
     and flexible_deadline>=new.starts_at
     and latitude is not null and longitude is not null
 loop
   dist:=trade_private.tradarr_route_distance_miles(new.mode,
     new.start_latitude,new.start_longitude,new.end_latitude,new.end_longitude,
     j.latitude,j.longitude);
   if dist<=new.max_deviation_miles and dist<=j.search_radius_miles then
     insert into public.job_offers(job_id,tradesperson_id,distance_miles,route_plan_id,status)
      values (j.id,new.tradesperson_id,round(dist::numeric,2),new.id,'offered')
      on conflict do nothing;
     update public.jobs set status='offered',updated_at=now()
       where id=j.id and status='posted'
         and exists(select 1 from public.job_offers
                    where job_id=j.id and tradesperson_id=new.tradesperson_id);
   end if;
 end loop;
 return null;
end $$;
revoke all on function trade_private.tradarr_route_plan_posted_matches() from public,anon,authenticated;
drop trigger if exists tradarr_match_posted_jobs_on_route on public.trade_route_plans;
create trigger tradarr_match_posted_jobs_on_route
 after insert or update of status on public.trade_route_plans
 for each row execute function trade_private.tradarr_route_plan_posted_matches();

