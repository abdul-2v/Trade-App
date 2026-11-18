CREATE OR REPLACE FUNCTION trade_private.tradarr_guard_route_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare ap record;
begin
 if tg_op='UPDATE' then
   if row(new.tradesperson_id,new.anchor_appointment_id,new.mode,new.trade,new.start_area,new.end_area,
      new.start_latitude,new.start_longitude,new.end_latitude,new.end_longitude,
      new.starts_at,new.ends_at,new.max_deviation_miles,new.max_extra_visits)
      is distinct from
      row(old.tradesperson_id,old.anchor_appointment_id,old.mode,old.trade,old.start_area,old.end_area,
       old.start_latitude,old.start_longitude,old.end_latitude,old.end_longitude,
       old.starts_at,old.ends_at,old.max_deviation_miles,old.max_extra_visits) then
     raise exception 'Published journey details are immutable. Close it and publish a new journey.'
       using errcode='42501';
   end if;
   if old.status='closed' and new.status<>'closed' then
     raise exception 'A closed journey cannot be reopened' using errcode='23514';
   end if;
   if new.status='closed' then
     new.updated_at:=now();
     return new;
   end if;
 end if;
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
end $function$;
CREATE OR REPLACE FUNCTION trade_private.tradarr_route_offer_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare plan record;job record;occupied int;distance double precision;anchor_status text;
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
   select a.status into anchor_status from public.trade_appointments a where a.id=plan.anchor_appointment_id;
   if anchor_status is null or anchor_status='cancelled' then
     raise exception 'This journey is no longer anchored to a valid booking' using errcode='23514';
   end if;
   select count(*) into occupied from public.job_offers o join public.jobs j on j.id=o.job_id
    where o.route_plan_id=old.route_plan_id and o.status='accepted'
      and j.status not in ('cancelled','completed');
   if occupied>=plan.max_extra_visits then
     raise exception 'This journey has reached its maximum extra visits' using errcode='23P01';
   end if;
 end if;
 return new;
end $function$;

create or replace function trade_private.tradarr_close_unanchored_routes()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='cancelled' or
    new.starts_at is distinct from old.starts_at or
    new.ends_at is distinct from old.ends_at then
  update public.trade_route_plans
    set status='closed',updated_at=now()
    where anchor_appointment_id=new.id and status<>'closed';
 end if;
 return null;
end $$;
revoke all on function trade_private.tradarr_close_unanchored_routes() from public,anon,authenticated;
drop trigger if exists tradarr_close_unanchored_routes on public.trade_appointments;
create trigger tradarr_close_unanchored_routes
after update of starts_at,ends_at,status on public.trade_appointments for each row
execute function trade_private.tradarr_close_unanchored_routes();

