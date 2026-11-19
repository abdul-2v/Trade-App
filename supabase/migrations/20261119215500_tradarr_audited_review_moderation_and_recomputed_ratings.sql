-- Moderated reviews stay in the audit/history but no longer count in published ratings.
create table if not exists public.tradarr_review_moderation(
 review_type text not null check(review_type in ('urgent','standard')),
 review_id uuid not null,
 is_hidden boolean not null default false,
 reason text not null check(char_length(btrim(reason)) between 12 and 2000),
 reviewed_by uuid not null references auth.users(id),
 reviewed_at timestamptz not null default now(),
 primary key(review_type,review_id)
);
alter table public.tradarr_review_moderation enable row level security;
revoke all on public.tradarr_review_moderation from public,anon;
grant select on public.tradarr_review_moderation to authenticated;
drop policy if exists tradarr_review_moderation_staff_only on public.tradarr_review_moderation;
create policy tradarr_review_moderation_staff_only on public.tradarr_review_moderation
 for select to authenticated using((select trade_private.tradarr_staff_authorised()));

create or replace function trade_private.tradarr_recalculate_public_rating(p_trader uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.tradesperson_profiles p set
  rating=coalesce((
   select round(avg(review_rating)::numeric,2) from (
    select j.rating::numeric review_rating from public.job_reviews j
     where j.tradesperson_id=p_trader and not exists(
      select 1 from public.tradarr_review_moderation m
      where m.review_type='urgent' and m.review_id=j.id and m.is_hidden=true)
    union all
    select r.rating::numeric from public.market_job_reviews r
     where r.tradesperson_id=p_trader and not exists(
      select 1 from public.tradarr_review_moderation m
      where m.review_type='standard' and m.review_id=r.id and m.is_hidden=true)
   ) visible
  ),0),
  review_count=(
   select count(*)::int from (
    select 1 from public.job_reviews j where j.tradesperson_id=p_trader
     and not exists(select 1 from public.tradarr_review_moderation m
      where m.review_type='urgent' and m.review_id=j.id and m.is_hidden=true)
    union all
    select 1 from public.market_job_reviews r where r.tradesperson_id=p_trader
     and not exists(select 1 from public.tradarr_review_moderation m
      where m.review_type='standard' and m.review_id=r.id and m.is_hidden=true)
   ) visible
  ),
  updated_at=now()
 where p.user_id=p_trader;
end $$;
revoke all on function trade_private.tradarr_recalculate_public_rating(uuid)
 from public,anon,authenticated;
create or replace function private.refresh_tradesperson_rating()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform trade_private.tradarr_recalculate_public_rating(
   case when tg_op='DELETE' then old.tradesperson_id else new.tradesperson_id end
 );
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function private.refresh_tradesperson_rating() from public,anon,authenticated;

create or replace function public.tradarr_admin_moderate_review(
 p_review_type text,p_review_id uuid,p_action text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare trader uuid;previous boolean;next_hidden boolean;
begin
 if (select auth.uid()) is null or not (select trade_private.tradarr_staff_authorised()) then
  raise exception 'Staff MFA required' using errcode='42501';end if;
 if p_review_type not in ('urgent','standard') or p_action not in ('hide','restore')
   or p_review_id is null or char_length(btrim(coalesce(p_reason,'')))<12
   or char_length(p_reason)>2000 then
  raise exception 'Select a review/action and explain the decision' using errcode='22023';end if;
 if p_review_type='urgent' then
  select tradesperson_id into trader from public.job_reviews where id=p_review_id;
 else
  select tradesperson_id into trader from public.market_job_reviews where id=p_review_id;
 end if;
 if trader is null then raise exception 'Review not found' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_review_type||p_review_id::text,5231));
 select coalesce((select is_hidden from public.tradarr_review_moderation
  where review_type=p_review_type and review_id=p_review_id),false) into previous;
 next_hidden:=p_action='hide';
 if previous=next_hidden then raise exception 'Review already has this status' using errcode='23514';end if;
 insert into public.tradarr_review_moderation(review_type,review_id,is_hidden,reason,reviewed_by,reviewed_at)
 values(p_review_type,p_review_id,next_hidden,btrim(p_reason),(select auth.uid()),now())
 on conflict(review_type,review_id) do update set
 is_hidden=excluded.is_hidden,reason=excluded.reason,
 reviewed_by=excluded.reviewed_by,reviewed_at=now();
 perform trade_private.tradarr_recalculate_public_rating(trader);
 insert into public.tradarr_admin_audit(actor_id,action,target_type,target_id,reason,metadata)
 values((select auth.uid()),
  case when next_hidden then 'review_hidden' else 'review_restored' end,
  'review',p_review_id,btrim(p_reason),
  jsonb_build_object('review_type',p_review_type,'before_hidden',previous,'is_hidden',next_hidden));
 return jsonb_build_object('review_type',p_review_type,'id',p_review_id,'is_hidden',next_hidden);
end $$;
revoke all on function public.tradarr_admin_moderate_review(text,uuid,text,text) from public,anon;
grant execute on function public.tradarr_admin_moderate_review(text,uuid,text,text) to authenticated;
