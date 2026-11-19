-- Backport of the live map security hardening and bounded RLS read model.
-- Also applied to the linked Supabase project via a managed migration.
alter policy trade_locations_active_customer_read on public.trade_locations using (
 user_id=(select auth.uid())
 or (
   updated_at>now()-interval '3 minutes'
   and exists (
     select 1 from public.trade_availability a where a.user_id=trade_locations.user_id
      and a.location_mode='live' and a.is_available is true
      and (a.available_until is null or a.available_until>now())
   )
   and (
     exists (select 1 from public.urgent_requests r
       where r.accepted_tradesperson_id=trade_locations.user_id
       and r.customer_id=(select auth.uid())
       and r.status in ('matched','en_route','arrived'))
     or exists (select 1 from public.jobs j
       where j.accepted_tradesperson_id=trade_locations.user_id
       and j.customer_id=(select auth.uid())
       and j.status in ('accepted','en_route','arrived','in_progress'))
   )
 )
);

-- The client must NOT download every trader/location in Britain.
-- SECURITY INVOKER ensures the caller's RLS rules still apply to each table.
create or replace function public.tradarr_public_marketplace_search(
 p_lat double precision, p_lon double precision, p_limit integer default 350)
returns table(profile jsonb, availability jsonb, presence jsonb)
language sql stable security invoker set search_path=public as $$
 select
 jsonb_build_object(
  'user_id',p.user_id,'display_name',p.display_name,'primary_trade',p.primary_trade,
  'avatar_url',p.avatar_url,'public_phone',p.public_phone,'is_verified',p.is_verified,
  'is_insured',p.is_insured,'rating',p.rating,'review_count',p.review_count,'bio',p.bio),
 jsonb_build_object(
  'user_id',a.user_id,'is_available',a.is_available,'radius_miles',a.radius_miles,
  'service_radius_miles',a.service_radius_miles,'emergency_opt_in',a.emergency_opt_in,
  'available_until',a.available_until,'location_mode',a.location_mode,
  'work_area_latitude',a.work_area_latitude,'work_area_longitude',a.work_area_longitude,
  'work_area_label',a.work_area_label),
 case when m.user_id is not null then jsonb_build_object(
  'user_id',m.user_id,'latitude',m.latitude,'longitude',m.longitude,
  'source_mode',m.source_mode,'updated_at',m.updated_at) else null::jsonb end
 from public.trade_availability a
 join public.tradesperson_profiles p on p.user_id=a.user_id
 left join public.trade_map_presence m on m.user_id=a.user_id
 where p_lat between 49 and 61 and p_lon between -9 and 3
 and not trade_private.tradarr_trade_paused(p.user_id)
 and coalesce(a.work_area_latitude,case when m.source_mode='work_area' then m.latitude end)
   between p_lat-0.83 and p_lat+0.83
 and coalesce(a.work_area_longitude,case when m.source_mode='work_area' then m.longitude end)
   between p_lon-(0.83/greatest(0.3,cos(radians(p_lat))))
       and p_lon+(0.83/greatest(0.3,cos(radians(p_lat))))
 order by abs(coalesce(a.work_area_latitude,m.latitude)-p_lat)
    +abs(coalesce(a.work_area_longitude,m.longitude)-p_lon),p.user_id
 limit least(greatest(coalesce(p_limit,350),1),350)
$$;
revoke all on function public.tradarr_public_marketplace_search(double precision,double precision,integer) from public,anon;
grant execute on function public.tradarr_public_marketplace_search(double precision,double precision,integer) to authenticated;
create index if not exists trade_availability_work_area_bbox_idx
 on public.trade_availability(work_area_latitude,work_area_longitude)
 where work_area_latitude is not null and work_area_longitude is not null;
