-- A revoked/stale Supabase Auth session must never retain staff powers while
-- its JWT is still within exp. This check is for sensitive admin operations,
-- not an extra DB lookup for every normal customer request.
create or replace function trade_private.tradarr_staff_authorised()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select auth.uid()) is not null,false)
  and coalesce((select auth.jwt()->>'aal')='aal2',false)
  and exists(
   select 1 from auth.users u
   where u.id=(select auth.uid()) and u.email_confirmed_at is not null
    and u.raw_app_meta_data->>'tradarr_staff'='true'
  )
  and exists(
   select 1 from auth.sessions s
   where s.user_id=(select auth.uid())
    and s.id::text=(select auth.jwt()->>'session_id')
    and s.aal::text='aal2'
    and (s.not_after is null or s.not_after>now())
  );
$$;
revoke all on function trade_private.tradarr_staff_authorised()
 from public,anon,authenticated;
grant execute on function trade_private.tradarr_staff_authorised() to authenticated;
