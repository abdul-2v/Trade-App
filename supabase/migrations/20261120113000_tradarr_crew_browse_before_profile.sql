-- Crew-only accounts can browse public paid opportunities immediately after signup.
-- An opt-in Crew profile remains mandatory for applications; customer accounts stay excluded.
drop policy if exists crew_requests_read on public.crew_requests;
create policy crew_requests_read on public.crew_requests
for select to authenticated using (
 owner_id=(select auth.uid())
 or (select trade_private.crew_is_applicant(id))
 or (
  status='open' and expires_at>now()
  and not trade_private.tradarr_account_suspended(owner_id)
  and not trade_private.tradarr_account_suspended((select auth.uid()))
  and exists (
   select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.account_type in ('crew','tradesperson')
  )
  and not trade_private.crew_blocked(owner_id,(select auth.uid()))
 )
);