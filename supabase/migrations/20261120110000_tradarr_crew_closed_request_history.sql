-- Applications remain accessible after the hirer closes a listing.
-- Security-definer lookup avoids a recursive RLS dependency between requests and applications.
create or replace function trade_private.crew_is_applicant(p_request_id uuid)
returns boolean language sql stable security definer set search_path='' as $crew$
 select auth.uid() is not null and exists(
  select 1 from public.crew_applications a
  where a.request_id=p_request_id and a.worker_id=auth.uid()
 );
$crew$;
revoke all on function trade_private.crew_is_applicant(uuid) from public,anon;
grant execute on function trade_private.crew_is_applicant(uuid) to authenticated;

drop policy if exists crew_requests_read on public.crew_requests;
create policy crew_requests_read on public.crew_requests for select to authenticated using(
 owner_id=(select auth.uid())
 or (select trade_private.crew_is_applicant(id))
 or (
  status='open' and expires_at>now()
  and not trade_private.tradarr_account_suspended(owner_id)
  and not trade_private.tradarr_account_suspended((select auth.uid()))
  and (
   exists(select 1 from public.tradesperson_profiles t where t.user_id=(select auth.uid()))
   or exists(select 1 from public.crew_profiles p where p.user_id=(select auth.uid()))
  )
  and not trade_private.crew_blocked(owner_id,(select auth.uid()))
 )
);
