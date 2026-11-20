-- A cancelled renewal keeps Pro access until the verified paid-through expiry.
-- Refund/revocation must move status to expired or shorten valid_until.
create or replace function public.tradarr_my_pro_status()
returns table(tier text,membership_status text,expires_at timestamptz,
 pro_access boolean,checkout_live boolean,enforcement_live boolean)
language sql stable security invoker set search_path=public as $$
 select coalesce(m.tier,'free')::text,coalesce(m.status,'inactive')::text,
  m.valid_until,
  coalesce(m.tier in ('pro','business') and
    m.status in ('trial','active','grace','cancelled') and m.valid_until>now(),false),
  coalesce(b.checkout_live,false),coalesce(b.enforcement_live,false)
 from (select (select auth.uid()) as current_user) u
 left join public.tradarr_memberships m on m.user_id=u.current_user
 left join public.tradarr_billing_controls b on b.singleton=true
 where u.current_user is not null
$$;
revoke all on function public.tradarr_my_pro_status() from public,anon;
grant execute on function public.tradarr_my_pro_status() to authenticated;
