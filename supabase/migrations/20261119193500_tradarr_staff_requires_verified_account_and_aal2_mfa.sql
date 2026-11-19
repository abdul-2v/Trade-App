-- Staff must have BOTH a live, verified server-managed role AND a recent MFA session.
-- Staff access is separate from customer/tradesperson account_type.
create or replace function trade_private.tradarr_staff_authorised()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select auth.jwt()->>'aal')='aal2',false)
  and exists(
   select 1 from auth.users u
    where u.id=(select auth.uid())
      and u.email_confirmed_at is not null
      and u.raw_app_meta_data->>'tradarr_staff'='true'
  );
$$;
revoke all on function trade_private.tradarr_staff_authorised() from public,anon,authenticated;
grant execute on function trade_private.tradarr_staff_authorised() to authenticated;
