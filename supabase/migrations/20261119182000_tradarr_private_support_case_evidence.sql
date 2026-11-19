-- Private photos and PDFs linked to support cases. Never public by URL.
create table if not exists public.support_case_evidence (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.support_requests(id) on delete cascade,
 uploader_id uuid not null references auth.users(id) on delete cascade,
 file_path text not null unique,
 file_name text not null check (char_length(file_name) between 1 and 120),
 mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
 created_at timestamptz not null default now(),
 constraint support_evidence_path_ownership check (
  split_part(file_path,'/',1)=case_id::text and
  split_part(file_path,'/',2)=uploader_id::text and
  split_part(file_path,'/',3)<>'' and split_part(file_path,'/',4)=''
 )
);
create index if not exists support_case_evidence_case_created_idx
 on public.support_case_evidence(case_id,created_at);
alter table public.support_case_evidence enable row level security;
revoke all on public.support_case_evidence from public,anon;
grant select,insert on public.support_case_evidence to authenticated;
drop policy if exists support_case_evidence_case_read on public.support_case_evidence;
create policy support_case_evidence_case_read on public.support_case_evidence
 for select to authenticated using (
 (select auth.jwt()->'app_metadata'->>'tradarr_staff')='true' or
 exists(select 1 from public.support_requests s
   where s.id=support_case_evidence.case_id and s.submitted_by=(select auth.uid()))
 );
drop policy if exists support_case_evidence_case_upload on public.support_case_evidence;
create policy support_case_evidence_case_upload on public.support_case_evidence
 for insert to authenticated with check (
 uploader_id=(select auth.uid()) and
 (
  (select auth.jwt()->'app_metadata'->>'tradarr_staff')='true' or
  exists(select 1 from public.support_requests s
    where s.id=support_case_evidence.case_id and s.submitted_by=(select auth.uid())
      and s.status in ('open','in_progress'))
 )
 );
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tradarr-support-evidence','tradarr-support-evidence',false,8388608,
 array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=8388608,
 allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp'];

drop policy if exists tradarr_support_evidence_upload on storage.objects;
create policy tradarr_support_evidence_upload on storage.objects
 for insert to authenticated with check (
 bucket_id='tradarr-support-evidence'
 and split_part(name,'/',2)=(select auth.uid())::text
 and split_part(name,'/',3)~'^[a-zA-Z0-9_-]{8,85}[.](pdf|jpg|png|webp)$'
 and split_part(name,'/',4)=''
 and (
  (select auth.jwt()->'app_metadata'->>'tradarr_staff')='true'
  or exists(
    select 1 from public.support_requests s
    where s.id::text=split_part(name,'/',1) and s.submitted_by=(select auth.uid())
      and s.status in ('open','in_progress')
  )
 )
 );
drop policy if exists tradarr_support_evidence_read on storage.objects;
create policy tradarr_support_evidence_read on storage.objects
 for select to authenticated using (
 bucket_id='tradarr-support-evidence' and
 (
  (select auth.jwt()->'app_metadata'->>'tradarr_staff')='true'
  or exists(select 1 from public.support_requests s
    where s.id::text=split_part(name,'/',1) and s.submitted_by=(select auth.uid()))
 )
 );
drop policy if exists tradarr_support_evidence_orphan_remove on storage.objects;
create policy tradarr_support_evidence_orphan_remove on storage.objects
 for delete to authenticated using (
 bucket_id='tradarr-support-evidence'
 and split_part(name,'/',2)=(select auth.uid())::text
 and not exists(select 1 from public.support_case_evidence e where e.file_path=storage.objects.name)
 );
;
