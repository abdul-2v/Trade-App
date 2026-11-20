-- Product allowlist and atomic, SERVICE-ONLY finalisation of VERIFIED purchases.
-- This is NOT a receipt verifier and does not create store products or enable checkout.
create table if not exists public.tradarr_store_product_catalog (
 provider text not null check(provider in ('apple','google')),
 product_id text not null check(length(product_id) between 3 and 160),
 kind text not null check(kind in ('subscription','boost')),
 tier text check(tier in ('pro','business')),
 boost_days integer check(boost_days between 1 and 90),
 enabled boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(provider,product_id),
 constraint tradarr_catalog_kind_fields check(
   (kind='subscription' and tier is not null and boost_days is null)
   or (kind='boost' and tier is null and boost_days is not null))
);
alter table public.tradarr_store_product_catalog enable row level security;
revoke all on public.tradarr_store_product_catalog from public,anon,authenticated;
grant select,insert,update,delete on public.tradarr_store_product_catalog to service_role;
-- No products are seeded. No invented prices or entitlements.
alter table public.tradarr_verified_purchase_events
 add column if not exists provider_event_at timestamptz;
create index if not exists tradarr_event_transaction_time_idx
 on public.tradarr_verified_purchase_events(provider,provider_transaction_id,provider_event_at desc)
 where provider_transaction_id is not null;
alter table public.tradarr_profile_boosts
 add column if not exists last_provider_event_at timestamptz;

create or replace function public.tradarr_finalize_verified_store_event(
 p_user_id uuid,p_provider text,p_product_id text,p_transaction_id text,
 p_event_id text,p_event_type text,p_provider_event_at timestamptz,
 p_verified_expiry timestamptz default null,
 p_store_purchase_at timestamptz default null,
 p_payload_sha256 text default null)
returns text language plpgsql volatile security invoker set search_path=public
as $$
declare product public.tradarr_store_product_catalog%rowtype;
        existing record; inserted_id uuid; effective_status text;
        effective_tier text; boost_start timestamptz;
        boost_end timestamptz; existing_boost record;
begin
 if current_user <> 'service_role' then
   raise exception 'Verified purchase finalisation is server-only' using errcode='42501';
 end if;
 if p_user_id is null or p_provider not in ('apple','google')
    or p_product_id is null or length(p_product_id)>160
    or p_transaction_id is null or length(p_transaction_id) not between 8 and 200
    or p_event_id is null or length(p_event_id) not between 6 and 200
    or p_event_type is null or p_provider_event_at is null
    or p_provider_event_at>now()+interval '5 minutes'
    or p_provider_event_at<now()-interval '3 years'
    or (p_payload_sha256 is not null and p_payload_sha256 !~ '^[0-9a-f]{64}$')
 then raise exception 'Invalid verified store event arguments' using errcode='22023';
 end if;

 select * into product from public.tradarr_store_product_catalog
  where provider=p_provider and product_id=p_product_id and enabled=true;
 if not found then raise exception 'Unregistered store product' using errcode='22023'; end if;
 if product.kind='subscription' and p_event_type not in
    ('subscription_active','subscription_cancelled','subscription_expired','subscription_revoked')
    or product.kind='boost' and p_event_type not in
    ('boost_purchased','boost_refunded')
 then raise exception 'Product and event type do not match' using errcode='22023'; end if;

 -- Serialise all events for an account, including simultaneous Apple/Google events.
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,77331));
 insert into public.tradarr_verified_purchase_events
  (provider,provider_event_id,event_type,user_id,provider_transaction_id,
    provider_event_at,verified_at,payload_sha256)
 values(p_provider,p_event_id,p_event_type,p_user_id,p_transaction_id,
    p_provider_event_at,now(),p_payload_sha256)
 on conflict(provider,provider_event_id) do nothing
 returning id into inserted_id;
 if inserted_id is null then return 'duplicate';end if;

 if product.kind='subscription' then
   select provider,provider_subscription_id,last_provider_event_at into existing
    from public.tradarr_membership_provider_records
    where user_id=p_user_id for update;
   if found and existing.last_provider_event_at>p_provider_event_at then
     update public.tradarr_verified_purchase_events set processed_at=now()
      where id=inserted_id;
     return 'stale';
   end if;
   -- An old, superseded subscription must not revoke a newer subscription.
   if p_event_type in ('subscription_expired','subscription_revoked','subscription_cancelled')
     and found and (existing.provider<>p_provider or existing.provider_subscription_id<>p_transaction_id)
   then
     update public.tradarr_verified_purchase_events set processed_at=now()
      where id=inserted_id;
     return 'superseded';
   end if;
   if p_event_type in ('subscription_active','subscription_cancelled') then
     if p_verified_expiry is null or p_verified_expiry<=now()
        or p_verified_expiry>now()+interval '400 days'
     then raise exception 'Verified subscription expiry is not valid' using errcode='22023';end if;
   end if;
   effective_tier:=case when p_event_type in
    ('subscription_active','subscription_cancelled') then product.tier else 'free' end;
   effective_status:=case p_event_type
    when 'subscription_active' then 'active'
    when 'subscription_cancelled' then 'cancelled'
    else 'expired' end;

   insert into public.tradarr_membership_provider_records
     (user_id,provider,provider_subscription_id,provider_product_id,last_provider_event_at,updated_at)
   values(p_user_id,p_provider,p_transaction_id,p_product_id,p_provider_event_at,now())
   on conflict(user_id) do update set
      provider=excluded.provider,
      provider_subscription_id=excluded.provider_subscription_id,
      provider_product_id=excluded.provider_product_id,
      last_provider_event_at=excluded.last_provider_event_at,
      updated_at=now();
   insert into public.tradarr_memberships
     (user_id,tier,status,provider,valid_until,last_verified_at,updated_at)
   values (p_user_id,effective_tier,effective_status,p_provider,
     case when effective_tier='free' then p_verified_expiry else p_verified_expiry end,
     now(),now())
   on conflict(user_id) do update set
     tier=excluded.tier,status=excluded.status,provider=excluded.provider,
     valid_until=excluded.valid_until,last_verified_at=excluded.last_verified_at,
     updated_at=now();
 else
   -- Non-renewing boosts use a server-maintained product duration and a
   -- store-verified transaction ID. No client decides its boost length.
   if p_event_type='boost_purchased' then
     if p_store_purchase_at is null
       or p_store_purchase_at>now()+interval '5 minutes'
       or p_store_purchase_at<now()-interval '180 days'
     then raise exception 'Verified boost purchase time missing' using errcode='22023';end if;
     if exists(
       select 1 from public.tradarr_verified_purchase_events e
       where e.provider=p_provider
       and e.provider_transaction_id=p_transaction_id
       and e.event_type='boost_refunded' and e.processed_at is not null
       and e.provider_event_at>=p_provider_event_at
     ) then
       update public.tradarr_verified_purchase_events set processed_at=now()
        where id=inserted_id;
       return 'already_refunded';
     end if;
     boost_start:=p_store_purchase_at;
     boost_end:=boost_start+make_interval(days=>product.boost_days);
     insert into public.tradarr_profile_boosts
       (user_id,provider,product_id,verified_transaction_id,verified_at,
        starts_at,ends_at,status,last_provider_event_at)
     values(p_user_id,p_provider,p_product_id,p_transaction_id,now(),
       boost_start,boost_end,
       case when boost_end>now() then 'active' else 'expired' end,
       p_provider_event_at)
     on conflict(provider,verified_transaction_id) do update set
       last_provider_event_at=excluded.last_provider_event_at
     where public.tradarr_profile_boosts.user_id=excluded.user_id
       and public.tradarr_profile_boosts.status<>'revoked'
       and (public.tradarr_profile_boosts.last_provider_event_at is null
        or public.tradarr_profile_boosts.last_provider_event_at<=p_provider_event_at);
   else
     update public.tradarr_profile_boosts set status='revoked',
       last_provider_event_at=p_provider_event_at
     where provider=p_provider and verified_transaction_id=p_transaction_id
       and user_id=p_user_id
       and (last_provider_event_at is null or last_provider_event_at<=p_provider_event_at);
   end if;
 end if;
 update public.tradarr_verified_purchase_events set processed_at=now()
  where id=inserted_id;
 return 'processed';
end $$;
revoke all on function public.tradarr_finalize_verified_store_event(
 uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,text)
 from public,anon,authenticated;
grant execute on function public.tradarr_finalize_verified_store_event(
 uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,text)
 to service_role;
