-- Staff revocations take effect at the database immediately, without waiting
-- for stale JWT app_metadata claims to expire. Grant via trusted auth admin only.
create or replace function trade_private.tradarr_staff_authorised()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from auth.users u
  where u.id=(select auth.uid())
    and u.raw_app_meta_data->>'tradarr_staff'='true'
 );
$$;
revoke all on function trade_private.tradarr_staff_authorised() from public,anon,authenticated;
grant execute on function trade_private.tradarr_staff_authorised() to authenticated;

drop policy if exists trade_credential_owner_select on public.trade_credential_submissions;
create policy trade_credential_owner_select on public.trade_credential_submissions
 for select to authenticated using (
   tradesperson_id=(select auth.uid())
   or (select trade_private.tradarr_staff_authorised())
 );
drop policy if exists trade_credential_staff_review on public.trade_credential_submissions;
create policy trade_credential_staff_review on public.trade_credential_submissions
 for update to authenticated
 using ((select trade_private.tradarr_staff_authorised()))
 with check ((select trade_private.tradarr_staff_authorised()));

drop policy if exists support_requests_staff_read on public.support_requests;
create policy support_requests_staff_read on public.support_requests
 for select to authenticated using ((select trade_private.tradarr_staff_authorised()));
drop policy if exists support_requests_staff_update on public.support_requests;
create policy support_requests_staff_update on public.support_requests
 for update to authenticated
 using ((select trade_private.tradarr_staff_authorised()))
 with check ((select trade_private.tradarr_staff_authorised()));

drop policy if exists support_case_updates_participant_read on public.support_case_updates;
create policy support_case_updates_participant_read on public.support_case_updates
 for select to authenticated using (
 (select trade_private.tradarr_staff_authorised())
 or (not internal_only and exists(
  select 1 from public.support_requests s where s.id=support_case_updates.case_id
    and s.submitted_by=(select auth.uid())))
 );
drop policy if exists support_case_updates_participant_post on public.support_case_updates;
create policy support_case_updates_participant_post on public.support_case_updates
 for insert to authenticated with check (
 author_id=(select auth.uid()) and (
  (select trade_private.tradarr_staff_authorised())
  or (not internal_only and exists(
   select 1 from public.support_requests s where s.id=support_case_updates.case_id
     and s.submitted_by=(select auth.uid()) and s.status in ('open','in_progress')))
 )
 );

drop policy if exists support_case_evidence_case_read on public.support_case_evidence;
create policy support_case_evidence_case_read on public.support_case_evidence
 for select to authenticated using (
 (select trade_private.tradarr_staff_authorised())
 or exists(select 1 from public.support_requests s
  where s.id=support_case_evidence.case_id and s.submitted_by=(select auth.uid()))
 );
drop policy if exists support_case_evidence_case_upload on public.support_case_evidence;
create policy support_case_evidence_case_upload on public.support_case_evidence
 for insert to authenticated with check (
 uploader_id=(select auth.uid()) and (
  (select trade_private.tradarr_staff_authorised())
  or exists(select 1 from public.support_requests s
   where s.id=support_case_evidence.case_id and s.submitted_by=(select auth.uid())
     and s.status in ('open','in_progress'))
 )
 );

drop policy if exists tradarr_credential_evidence_read on storage.objects;
create policy tradarr_credential_evidence_read on storage.objects
 for select to authenticated using (
 bucket_id='tradarr-credentials' and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or (select trade_private.tradarr_staff_authorised())
 )
 );

drop policy if exists tradarr_support_evidence_upload on storage.objects;
create policy tradarr_support_evidence_upload on storage.objects
 for insert to authenticated with check (
 bucket_id='tradarr-support-evidence'
 and split_part(name,'/',2)=(select auth.uid())::text
 and split_part(name,'/',3)~'^[a-zA-Z0-9_-]{8,85}[.](pdf|jpg|png|webp)$'
 and split_part(name,'/',4)=''
 and (
  (select trade_private.tradarr_staff_authorised())
  or exists(select 1 from public.support_requests s
    where s.id::text=split_part(name,'/',1)
      and s.submitted_by=(select auth.uid())
      and s.status in ('open','in_progress'))
 )
 );
drop policy if exists tradarr_support_evidence_read on storage.objects;
create policy tradarr_support_evidence_read on storage.objects
 for select to authenticated using (
 bucket_id='tradarr-support-evidence' and (
  (select trade_private.tradarr_staff_authorised())
  or exists(select 1 from public.support_requests s
   where s.id::text=split_part(name,'/',1) and s.submitted_by=(select auth.uid()))
 )
 );
;
