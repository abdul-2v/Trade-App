-- Crew authorisation hardening and current-only placement acceptance.
drop policy if exists crew_profiles_insert on public.crew_profiles;
create policy crew_profiles_insert on public.crew_profiles
for insert to authenticated with check (
 user_id=(select auth.uid()) and adult_confirmed
 and not trade_private.tradarr_account_suspended((select auth.uid()))
 and exists(select 1 from public.profiles p where p.id=(select auth.uid())
  and p.account_type in ('tradesperson','crew'))
);
drop policy if exists crew_profiles_update on public.crew_profiles;
create policy crew_profiles_update on public.crew_profiles for update to authenticated
using (
 user_id=(select auth.uid())
 and not trade_private.tradarr_account_suspended((select auth.uid()))
 and exists(select 1 from public.profiles p where p.id=(select auth.uid())
  and p.account_type in ('tradesperson','crew'))
)
with check(user_id=(select auth.uid()) and adult_confirmed);

drop policy if exists crew_requests_insert on public.crew_requests;
create policy crew_requests_insert on public.crew_requests for insert to authenticated with check(
 owner_id=(select auth.uid()) and status='open'
 and exists(select 1 from public.profiles p where p.id=(select auth.uid())
   and p.account_type='tradesperson')
 and not trade_private.tradarr_account_suspended((select auth.uid()))
 and not trade_private.tradarr_trade_paused((select auth.uid()))
 and expires_at>now()
);

create or replace function public.crew_set_application_status(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $crew$
declare v_app public.crew_applications%rowtype;
 v_request public.crew_requests%rowtype;
 v_actor uuid := auth.uid();
begin
 if v_actor is null or trade_private.tradarr_account_suspended(v_actor) then
  raise exception 'Sign in to an active account' using errcode='42501';
 end if;
 select * into v_app from public.crew_applications where id=p_id for update;
 if not found then raise exception 'Application not found' using errcode='P0002'; end if;
 select * into v_request from public.crew_requests where id=v_app.request_id for update;
 if v_actor=v_app.worker_id and p_status='withdrawn' and v_app.status in ('applied','shortlisted','accepted') then
  null;
 elsif v_actor=v_request.owner_id and p_status in ('shortlisted','accepted','declined')
  and v_app.status in ('applied','shortlisted')
  and v_request.status='open' and v_request.expires_at>now()
  and not trade_private.tradarr_trade_paused(v_actor)
  and not trade_private.crew_blocked(v_request.owner_id,v_app.worker_id)
  and not trade_private.tradarr_account_suspended(v_app.worker_id) then
  if p_status='accepted' and
   (select count(*) from public.crew_applications
     where request_id=v_request.id and status='accepted')>=v_request.positions then
   raise exception 'All places are already filled';
  end if;
 else
  raise exception 'Application transition not allowed' using errcode='42501';
 end if;
 update public.crew_applications set status=p_status,updated_at=now() where id=p_id;
end;
$crew$;
revoke all on function public.crew_set_application_status(uuid,text) from public,anon;
grant execute on function public.crew_set_application_status(uuid,text) to authenticated;
