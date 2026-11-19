-- Soft-pause public discovery of a trade profile, never delete jobs or invoices.
create table if not exists public.tradarr_trade_moderation (
 tradesperson_id uuid primary key references public.tradesperson_profiles(user_id) on delete cascade,
 is_paused boolean not null default false,
 reason text not null check(char_length(btrim(reason)) between 12 and 2000),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.tradarr_trade_moderation enable row level security;
revoke all on public.tradarr_trade_moderation from public,anon,authenticated;
grant select on public.tradarr_trade_moderation to authenticated;
drop policy if exists tradarr_trade_moderation_admin_only on public.tradarr_trade_moderation;
create policy tradarr_trade_moderation_admin_only on public.tradarr_trade_moderation
 for select to authenticated using ((select trade_private.tradarr_staff_authorised()));

-- Only public visibility, not private booking history, is affected.
create or replace function trade_private.tradarr_trade_paused(p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.tradarr_trade_moderation m
  where m.tradesperson_id=p_user_id and m.is_paused=true)
$$;
revoke all on function trade_private.tradarr_trade_paused(uuid) from public;
grant execute on function trade_private.tradarr_trade_paused(uuid) to anon,authenticated;

-- Keep self-visibility for profile editing, but hide suspended businesses from discovery.
drop policy if exists tradesperson_profiles_public_read on public.tradesperson_profiles;
create policy tradesperson_profiles_public_read on public.tradesperson_profiles
 for select to public using (
  user_id=(select auth.uid()) or not trade_private.tradarr_trade_paused(user_id)
 );
drop policy if exists trade_availability_public_read on public.trade_availability;
create policy trade_availability_public_read on public.trade_availability
 for select to public using (
  user_id=(select auth.uid()) or not trade_private.tradarr_trade_paused(user_id)
 );
drop policy if exists trade_map_presence_appropriate_visibility on public.trade_map_presence;
create policy trade_map_presence_appropriate_visibility on public.trade_map_presence
 for select to authenticated using (
  user_id=(select auth.uid()) or
  (
   not trade_private.tradarr_trade_paused(user_id)
   and (
    source_mode='work_area' or (
      source_mode='live'
      and updated_at>now()-interval '10 minutes'
      and exists(
       select 1 from public.trade_availability a
       where a.user_id=trade_map_presence.user_id
        and a.location_mode='live' and a.is_available is true
        and (a.available_until is null or a.available_until>now())
      )
    )
   )
  )
 );

-- Suspended traders must not re-publish themselves by toggling availability.
create or replace function trade_private.tradarr_guard_paused_trade_availability()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 if new.is_available is true and trade_private.tradarr_trade_paused(new.user_id) then
  raise exception 'This profile is temporarily paused from public listings; contact Tradarr support'
    using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function trade_private.tradarr_guard_paused_trade_availability() from public,anon,authenticated;
drop trigger if exists tradarr_guard_paused_trade_availability on public.trade_availability;
create trigger tradarr_guard_paused_trade_availability
 before insert or update on public.trade_availability
 for each row execute function trade_private.tradarr_guard_paused_trade_availability();

create or replace function public.tradarr_admin_moderate_trade(
 p_trade_id uuid,p_action text,p_reason text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare previous boolean;desired boolean;
begin
 if (select auth.uid()) is null or not (select trade_private.tradarr_staff_authorised()) then
  raise exception 'Verified administrator and second factor required' using errcode='42501';
 end if;
 if p_trade_id is null or p_trade_id=(select auth.uid()) then
  raise exception 'Choose another legitimate tradesperson account' using errcode='42501';
 end if;
 if p_action not in ('pause','restore') or char_length(btrim(coalesce(p_reason,'')))<12
   or char_length(p_reason)>2000 then
  raise exception 'Choose pause/restore and enter at least 12 characters of reasoning'
    using errcode='22023';
 end if;
 if not exists(select 1 from public.tradesperson_profiles t where t.user_id=p_trade_id) then
  raise exception 'Tradesperson profile not found' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_trade_id::text,1819));
 select coalesce((select m.is_paused from public.tradarr_trade_moderation m
   where m.tradesperson_id=p_trade_id),false) into previous;
 desired:=(p_action='pause');
 if previous=desired then
  raise exception 'Trade listing already has that status' using errcode='23514';
 end if;
 insert into public.tradarr_trade_moderation(tradesperson_id,is_paused,reason,updated_by,updated_at)
 values(p_trade_id,desired,btrim(p_reason),(select auth.uid()),now())
 on conflict(tradesperson_id) do update set
   is_paused=excluded.is_paused,reason=excluded.reason,
   updated_by=excluded.updated_by,updated_at=now();
 if desired then
  update public.trade_availability
   set is_available=false,available_until=now(),updated_at=now()
   where user_id=p_trade_id;
 end if;
 insert into public.tradarr_admin_audit(actor_id,action,target_type,target_id,reason,metadata)
 values((select auth.uid()),case when desired then 'trade_listing_paused' else 'trade_listing_restored' end,
 'trader',p_trade_id,btrim(p_reason),
 jsonb_build_object('previous_paused',previous,'now_paused',desired));
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(p_trade_id,'trade-moderation:'||p_trade_id||':'||extract(epoch from now())::text,
 'support_update',
 case when desired then 'Your trade listing has been paused' else 'Your trade listing has been restored' end,
 case when desired then 'Your public trade listing is paused. Your existing jobs and records remain available. Contact support for details.'
 else 'Your public listing is restored. Turn your availability back on when you are ready.' end,
 jsonb_build_object('screen','tradeSupport'))
 on conflict(recipient_id,event_key) do nothing;
 return jsonb_build_object('tradesperson_id',p_trade_id,'is_paused',desired);
end $$;
revoke all on function public.tradarr_admin_moderate_trade(uuid,text,text) from public,anon;
grant execute on function public.tradarr_admin_moderate_trade(uuid,text,text) to authenticated;

-- Include moderation status in the staff browse function via a small wrapper
-- in the frontend's separate lookup of the private, staff-readable moderation table.
