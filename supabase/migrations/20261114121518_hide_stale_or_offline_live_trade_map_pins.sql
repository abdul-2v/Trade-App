-- Protect live travelling locations when a trade is offline or its position is stale.
-- Public work-area markers remain intentionally approximate and discoverable.
drop policy if exists trade_map_presence_public_read on public.trade_map_presence;
create policy trade_map_presence_appropriate_visibility
on public.trade_map_presence
for select to anon, authenticated
using (
  user_id = (select auth.uid())
  or source_mode = 'work_area'
  or (
    source_mode = 'live'
    and updated_at > now() - interval '15 minutes'
    and exists (
      select 1 from public.trade_availability availability
      where availability.user_id = trade_map_presence.user_id
        and availability.is_available is true
        and (availability.available_until is null or availability.available_until > now())
    )
  )
);
