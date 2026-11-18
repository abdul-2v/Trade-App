-- Permanent service coverage is independent of immediate dispatch availability.
alter table public.trade_availability
  add column if not exists service_radius_miles numeric(6,2) not null default 20,
  add column if not exists emergency_opt_in boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trade_availability_service_radius_range') then
    alter table public.trade_availability
      add constraint trade_availability_service_radius_range
      check (service_radius_miles >= 1 and service_radius_miles <= 50);
  end if;
end $$;

-- Public live presence must expire, be opted in and belong to a person
-- accepting jobs. Saved work-area pins remain discoverable while offline.
drop policy if exists trade_map_presence_appropriate_visibility on public.trade_map_presence;
create policy trade_map_presence_appropriate_visibility
on public.trade_map_presence for select to anon, authenticated
using (
  user_id = (select auth.uid())
  or source_mode = 'work_area'
  or (
    source_mode = 'live'
    and updated_at > now() - interval '10 minutes'
    and exists (
      select 1 from public.trade_availability a
      where a.user_id = trade_map_presence.user_id
        and a.location_mode = 'live'
        and a.is_available is true
        and (a.available_until is null or a.available_until > now())
    )
  )
);
grant select on public.trade_availability to anon, authenticated;
grant insert, update on public.trade_availability to authenticated;
