-- Server-verified profile boosts: expose only a boolean "Promoted" marker.
-- Clients cannot create/modify this public projection or view paid receipts.
create table if not exists public.tradarr_public_boost_markers (
 boost_id uuid primary key references public.tradarr_profile_boosts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 updated_at timestamptz not null default now(),
 constraint tradarr_public_boost_dates_valid check(ends_at>starts_at)
);
create index if not exists tradarr_public_boost_by_trader_active
 on public.tradarr_public_boost_markers(user_id,starts_at,ends_at);
alter table public.tradarr_public_boost_markers enable row level security;
revoke all on public.tradarr_public_boost_markers from public,anon,authenticated;
grant select on public.tradarr_public_boost_markers to authenticated;
grant select,insert,update,delete on public.tradarr_public_boost_markers to service_role;
drop policy if exists tradarr_public_active_verified_boosts on public.tradarr_public_boost_markers;
create policy tradarr_public_active_verified_boosts
 on public.tradarr_public_boost_markers for select to authenticated
 using (
   starts_at<=now() and ends_at>now()
   and exists(select 1 from public.tradarr_billing_controls b
     where b.singleton and b.boosts_live and b.checkout_live and b.receipt_verifier_ready)
 );
-- Non-exposed trigger maintains only a harmless public projection.
create or replace function trade_private.tradarr_sync_boost_marker()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if TG_OP='DELETE' then
   delete from public.tradarr_public_boost_markers where boost_id=OLD.id;
   return OLD;
 end if;
 if NEW.status='active' and NEW.verified_at<=now() and NEW.ends_at>NEW.starts_at then
   insert into public.tradarr_public_boost_markers
    (boost_id,user_id,starts_at,ends_at,updated_at)
   values(NEW.id,NEW.user_id,NEW.starts_at,NEW.ends_at,now())
   on conflict(boost_id) do update set
     user_id=excluded.user_id,starts_at=excluded.starts_at,
     ends_at=excluded.ends_at,updated_at=now();
 else
   delete from public.tradarr_public_boost_markers where boost_id=NEW.id;
 end if;
 return NEW;
end $$;
revoke all on function trade_private.tradarr_sync_boost_marker()
 from public,anon,authenticated;
drop trigger if exists tradarr_boost_marker_sync on public.tradarr_profile_boosts;
create trigger tradarr_boost_marker_sync
 after insert or update or delete on public.tradarr_profile_boosts
 for each row execute function trade_private.tradarr_sync_boost_marker();
-- Existing (verified) rows, if any, are backfilled. No fake purchases created.
insert into public.tradarr_public_boost_markers(boost_id,user_id,starts_at,ends_at)
select id,user_id,starts_at,ends_at from public.tradarr_profile_boosts
 where status='active' and verified_at<=now() and ends_at>starts_at
on conflict(boost_id) do nothing;

-- Keep the marketplace read model as SECURITY INVOKER, relying on the
-- restricted projection's RLS. Neither purchases nor private transactions leak.
create or replace function public.tradarr_public_marketplace_search(
 p_lat double precision,p_lon double precision,p_limit integer default 350)
returns table(profile jsonb,availability jsonb,presence jsonb)
language sql stable security invoker set search_path=public as $$
select
 jsonb_build_object(
  'user_id',p.user_id,'display_name',p.display_name,'primary_trade',p.primary_trade,
  'avatar_url',p.avatar_url,'public_phone',p.public_phone,'is_verified',p.is_verified,
  'is_insured',p.is_insured,'rating',p.rating,'review_count',p.review_count,'bio',p.bio,
  'promoted',exists(select 1 from public.tradarr_public_boost_markers bm
    where bm.user_id=p.user_id)
 ) as profile,
 jsonb_build_object(
  'user_id',a.user_id,'is_available',a.is_available,'radius_miles',a.radius_miles,
  'service_radius_miles',a.service_radius_miles,'emergency_opt_in',a.emergency_opt_in,
  'available_until',a.available_until,'location_mode',a.location_mode,
  'work_area_latitude',a.work_area_latitude,'work_area_longitude',a.work_area_longitude,
  'work_area_label',a.work_area_label
 ) as availability,
 case when m.user_id is not null then jsonb_build_object(
  'user_id',m.user_id,'latitude',m.latitude,'longitude',m.longitude,
  'source_mode',m.source_mode,'updated_at',m.updated_at)
 else null::jsonb end as presence
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
order by
 abs(coalesce(a.work_area_latitude,m.latitude)-p_lat)
 +abs(coalesce(a.work_area_longitude,m.longitude)-p_lon),p.user_id
limit least(greatest(coalesce(p_limit,350),1),350)
$$;
revoke all on function public.tradarr_public_marketplace_search(double precision,double precision,integer) from public,anon;
grant execute on function public.tradarr_public_marketplace_search(double precision,double precision,integer) to authenticated;
