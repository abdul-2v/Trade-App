-- Build a read-only Pro membership foundation. This does not sell anything.
-- ONLY server-side verification via Apple/Google may write paid memberships.
create table if not exists public.tradarr_memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 tier text not null default 'free' check (tier in ('free','pro','business')),
 status text not null default 'inactive' check (status in ('inactive','trial','active','grace','cancelled','expired')),
 provider text not null default 'none' check (provider in ('none','apple','google','web','staff_trial')),
 valid_until timestamptz,
 last_verified_at timestamptz,
 updated_at timestamptz not null default now(),
 constraint tradarr_paid_membership_requires_expiry check (tier='free' or valid_until is not null)
);
create table if not exists public.tradarr_membership_provider_records (
 user_id uuid primary key references auth.users(id) on delete cascade,
 provider text not null check (provider in ('apple','google','web')),
 provider_subscription_id text not null,
 provider_product_id text not null,
 verification_metadata jsonb not null default '{}'::jsonb,
 last_provider_event_at timestamptz,updated_at timestamptz not null default now(),
 unique(provider,provider_subscription_id)
);
create table if not exists public.tradarr_billing_controls (
 singleton boolean primary key default true check(singleton),
 checkout_live boolean not null default false,
 enforcement_live boolean not null default false,
 updated_at timestamptz not null default now(),
 constraint tradarr_cannot_enforce_before_checkout check(not enforcement_live or checkout_live)
);
insert into public.tradarr_billing_controls(singleton,checkout_live,enforcement_live)
 values(true,false,false) on conflict(singleton) do nothing;
alter table public.tradarr_memberships enable row level security;
alter table public.tradarr_membership_provider_records enable row level security;
alter table public.tradarr_billing_controls enable row level security;
revoke all on public.tradarr_memberships from public,anon,authenticated;
revoke all on public.tradarr_membership_provider_records from public,anon,authenticated;
revoke all on public.tradarr_billing_controls from public,anon,authenticated;
grant select on public.tradarr_memberships to authenticated;
grant select on public.tradarr_billing_controls to authenticated;
grant select,insert,update,delete on public.tradarr_memberships to service_role;
grant select,insert,update,delete on public.tradarr_membership_provider_records to service_role;
grant select,insert,update,delete on public.tradarr_billing_controls to service_role;
drop policy if exists tradarr_memberships_owner_read on public.tradarr_memberships;
create policy tradarr_memberships_owner_read on public.tradarr_memberships
 for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists tradarr_billing_controls_flags_read on public.tradarr_billing_controls;
create policy tradarr_billing_controls_flags_read
 on public.tradarr_billing_controls for select to authenticated using(true);
create or replace function public.tradarr_my_pro_status()
returns table(tier text,membership_status text,expires_at timestamptz,
 pro_access boolean,checkout_live boolean,enforcement_live boolean)
language sql stable security invoker set search_path=public as $$
 select coalesce(m.tier,'free')::text,coalesce(m.status,'inactive')::text,
   m.valid_until,
   coalesce(m.tier in ('pro','business') and
     m.status in ('trial','active','grace') and m.valid_until>now(),false),
   coalesce(b.checkout_live,false),coalesce(b.enforcement_live,false)
 from (select (select auth.uid()) as current_user) u
 left join public.tradarr_memberships m on m.user_id=u.current_user
 left join public.tradarr_billing_controls b on b.singleton=true
 where u.current_user is not null
$$;
revoke all on function public.tradarr_my_pro_status() from public,anon;
grant execute on function public.tradarr_my_pro_status() to authenticated;
