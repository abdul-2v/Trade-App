-- Coarse, public-facing coordinates; exact GPS is held separately.
create or replace function public.tradarr_coarsen_presence()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.latitude := round(new.latitude::numeric,2)::double precision;
  new.longitude := round(new.longitude::numeric,2)::double precision;
  return new;
end $$;
drop trigger if exists tradarr_coarsen_presence_before_write on public.trade_map_presence;
create trigger tradarr_coarsen_presence_before_write
before insert or update on public.trade_map_presence
for each row execute function public.tradarr_coarsen_presence();

create or replace function public.tradarr_coarsen_work_area()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.work_area_latitude is not null then
    new.work_area_latitude := round(new.work_area_latitude::numeric,2)::double precision;
  end if;
  if new.work_area_longitude is not null then
    new.work_area_longitude := round(new.work_area_longitude::numeric,2)::double precision;
  end if;
  return new;
end $$;
drop trigger if exists tradarr_coarsen_work_area_before_write on public.trade_availability;
create trigger tradarr_coarsen_work_area_before_write
before insert or update on public.trade_availability
for each row execute function public.tradarr_coarsen_work_area();

update public.trade_map_presence
set latitude = round(latitude::numeric,2)::double precision,
    longitude = round(longitude::numeric,2)::double precision
where latitude <> round(latitude::numeric,2)::double precision
   or longitude <> round(longitude::numeric,2)::double precision;
update public.trade_availability
set work_area_latitude = round(work_area_latitude::numeric,2)::double precision,
    work_area_longitude = round(work_area_longitude::numeric,2)::double precision
where work_area_latitude is not null and work_area_longitude is not null
  and (work_area_latitude <> round(work_area_latitude::numeric,2)::double precision
    or work_area_longitude <> round(work_area_longitude::numeric,2)::double precision);

-- Old/private GPS is never readable after opting out or when stale.
drop policy if exists trade_locations_active_customer_read on public.trade_locations;
create policy trade_locations_active_customer_read on public.trade_locations
for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    updated_at > now() - interval '10 minutes'
    and exists (
      select 1 from public.trade_availability a
      where a.user_id = trade_locations.user_id and a.location_mode = 'live'
    )
    and (
      exists (
        select 1 from public.urgent_requests request
        where request.accepted_tradesperson_id = trade_locations.user_id
          and request.customer_id = (select auth.uid())
          and request.status in ('matched','en_route','arrived')
      )
      or exists (
        select 1 from public.jobs job
        where job.accepted_tradesperson_id = trade_locations.user_id
          and job.customer_id = (select auth.uid())
          and job.status in ('accepted','en_route','arrived','in_progress')
      )
    )
  )
);
