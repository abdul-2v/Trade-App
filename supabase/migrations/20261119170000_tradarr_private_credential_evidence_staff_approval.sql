-- Evidence is never public. Only staff may award or revoke public badges.
create table if not exists public.trade_credential_submissions (
  id uuid primary key default gen_random_uuid(),
  tradesperson_id uuid not null references public.tradesperson_profiles(user_id) on delete cascade,
  kind text not null check (kind in ('identity','business','insurance','qualification')),
  evidence_path text not null unique,
  applicant_note text check (applicant_note is null or char_length(applicant_note)<=1000),
  status text not null default 'submitted'
    check (status in ('submitted','reviewing','approved','rejected','revoked')),
  valid_until date,
  review_note text check (review_note is null or char_length(review_note)<=2000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credential_own_evidence check (
    split_part(evidence_path,'/',1)=tradesperson_id::text and
    split_part(evidence_path,'/',2)<>'' and split_part(evidence_path,'/',3)=''
  )
);
create unique index if not exists trade_credential_one_active_kind
  on public.trade_credential_submissions(tradesperson_id,kind)
  where status in ('submitted','reviewing');
create index if not exists trade_credential_review_queue
  on public.trade_credential_submissions(status,created_at);
alter table public.trade_credential_submissions enable row level security;
revoke all on public.trade_credential_submissions from public,anon;
grant select,insert,update on public.trade_credential_submissions to authenticated;
drop policy if exists trade_credential_owner_select on public.trade_credential_submissions;
create policy trade_credential_owner_select on public.trade_credential_submissions
  for select to authenticated using (
    tradesperson_id=(select auth.uid())
    or (select auth.jwt()->'app_metadata'->>'tradarr_staff')='true'
  );
drop policy if exists trade_credential_owner_submit on public.trade_credential_submissions;
create policy trade_credential_owner_submit on public.trade_credential_submissions
  for insert to authenticated with check (
    tradesperson_id=(select auth.uid())
    and status='submitted' and reviewed_by is null and reviewed_at is null
    and review_note is null and valid_until is null
  );
drop policy if exists trade_credential_staff_review on public.trade_credential_submissions;
create policy trade_credential_staff_review on public.trade_credential_submissions
  for update to authenticated
  using ((select auth.jwt()->'app_metadata'->>'tradarr_staff')='true')
  with check ((select auth.jwt()->'app_metadata'->>'tradarr_staff')='true');

create or replace function trade_private.tradarr_credential_review_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if current_user not in ('postgres','service_role')
    and (select auth.jwt()->'app_metadata'->>'tradarr_staff') is distinct from 'true' then
   raise exception 'Only Tradarr staff can review credentials' using errcode='42501';
 end if;
 if (to_jsonb(new)-'status'-'valid_until'-'review_note'-'reviewed_by'-'reviewed_at'-'updated_at')
    is distinct from
    (to_jsonb(old)-'status'-'valid_until'-'review_note'-'reviewed_by'-'reviewed_at'-'updated_at') then
   raise exception 'Evidence cannot be changed after submission' using errcode='42501';
 end if;
 if new.status is distinct from old.status and not (
    (old.status='submitted' and new.status in ('reviewing','approved','rejected'))
    or (old.status='reviewing' and new.status in ('approved','rejected'))
    or (old.status='approved' and new.status='revoked')
 ) then
   raise exception 'Invalid credential review transition' using errcode='23514';
 end if;
 if new.status='approved' and new.kind='insurance'
    and (new.valid_until is null or new.valid_until<current_date) then
   raise exception 'Insurance approval requires a future expiry date' using errcode='23514';
 end if;
 if new.valid_until is distinct from old.valid_until and new.kind<>'insurance' then
   raise exception 'Expiry date is only used for insurance evidence' using errcode='23514';
 end if;
 if new.status is distinct from old.status or new.valid_until is distinct from old.valid_until then
   new.reviewed_by:=(select auth.uid());
   new.reviewed_at:=now();
 end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function trade_private.tradarr_credential_review_guard() from public,anon,authenticated;
drop trigger if exists tradarr_credential_review_guard on public.trade_credential_submissions;
create trigger tradarr_credential_review_guard before update on public.trade_credential_submissions
  for each row execute function trade_private.tradarr_credential_review_guard();

create or replace function trade_private.tradarr_recompute_trade_badges(p_trade_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.trade_credential_submissions
               where tradesperson_id=p_trade_id) then return; end if;
 update public.tradesperson_profiles tp set
   is_verified=exists(select 1 from public.trade_credential_submissions c
     where c.tradesperson_id=p_trade_id and c.kind in ('identity','business')
       and c.status='approved'),
   is_insured=exists(select 1 from public.trade_credential_submissions c
     where c.tradesperson_id=p_trade_id and c.kind='insurance'
       and c.status='approved' and c.valid_until>=current_date),
   updated_at=now()
 where tp.user_id=p_trade_id;
end $$;
revoke all on function trade_private.tradarr_recompute_trade_badges(uuid) from public,anon,authenticated;
create or replace function trade_private.tradarr_credential_review_after()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform trade_private.tradarr_recompute_trade_badges(new.tradesperson_id);
 return null;
end $$;
revoke all on function trade_private.tradarr_credential_review_after() from public,anon,authenticated;
drop trigger if exists tradarr_credential_review_after on public.trade_credential_submissions;
create trigger tradarr_credential_review_after after update of status,valid_until
  on public.trade_credential_submissions for each row
  execute function trade_private.tradarr_credential_review_after();

create or replace function trade_private.tradarr_expire_credential_badges()
returns void language plpgsql security definer set search_path='' as $$
declare v_trade_id uuid;
begin
 for v_trade_id in select distinct tradesperson_id from public.trade_credential_submissions
 loop
   perform trade_private.tradarr_recompute_trade_badges(v_trade_id);
 end loop;
end $$;
revoke all on function trade_private.tradarr_expire_credential_badges() from public,anon,authenticated;
-- Expired insurance must not remain marked insured indefinitely.
do $$
begin
 if not exists(select 1 from cron.job where jobname='tradarr-credential-expiry-daily') then
   perform cron.schedule('tradarr-credential-expiry-daily','20 2 * * *',
     'select trade_private.tradarr_expire_credential_badges();');
 end if;
end $$;

-- Private evidence stored under the trade user's UUID; never expose bucket URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tradarr-credentials','tradarr-credentials',false,8388608,
 array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=8388608,
 allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp'];
drop policy if exists tradarr_credential_evidence_insert on storage.objects;
create policy tradarr_credential_evidence_insert on storage.objects
 for insert to authenticated with check (
 bucket_id='tradarr-credentials' and
 (storage.foldername(name))[1]=(select auth.uid())::text and
 split_part(name,'/',2) ~ '^[a-zA-Z0-9_-]{8,85}[.](pdf|jpg|png|webp)$'
 and split_part(name,'/',3)=''
 and exists(select 1 from public.tradesperson_profiles t where t.user_id=(select auth.uid()))
 );
drop policy if exists tradarr_credential_evidence_read on storage.objects;
create policy tradarr_credential_evidence_read on storage.objects
 for select to authenticated using (
 bucket_id='tradarr-credentials' and (
 (storage.foldername(name))[1]=(select auth.uid())::text
 or (select auth.jwt()->'app_metadata'->>'tradarr_staff')='true')
 );
-- Orphan uploads are removable by their owner, but submitted evidence is immutable.
drop policy if exists tradarr_credential_evidence_orphan_delete on storage.objects;
create policy tradarr_credential_evidence_orphan_delete on storage.objects
 for delete to authenticated using (
 bucket_id='tradarr-credentials'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and not exists(
   select 1 from public.trade_credential_submissions c
   where c.evidence_path=storage.objects.name
 )
 );
;
