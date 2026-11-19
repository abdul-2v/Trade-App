-- Structured member reports, moderation appeals and irreversible deletion requests.
create table if not exists public.tradarr_safety_reports(
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 target_type text not null check(target_type in ('user','trader','review','job','conversation')),
 target_ref text not null check(char_length(target_ref) between 3 and 100),
 category text not null check(category in ('harassment','fraud','safety','fake_profile','misconduct','other')),
 details text not null check(char_length(btrim(details)) between 15 and 2500),
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 staff_note text check(staff_note is null or char_length(staff_note)<=2000),
 handled_by uuid references auth.users(id),
 handled_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists tradarr_reports_triage on public.tradarr_safety_reports(status,created_at desc);
alter table public.tradarr_safety_reports enable row level security;
revoke all on public.tradarr_safety_reports from public,anon;
grant select,insert on public.tradarr_safety_reports to authenticated;
drop policy if exists tradarr_reports_participants_read on public.tradarr_safety_reports;
create policy tradarr_reports_participants_read on public.tradarr_safety_reports
 for select to authenticated using(reporter_id=(select auth.uid()) or
  (select trade_private.tradarr_staff_authorised()));
drop policy if exists tradarr_reports_member_insert on public.tradarr_safety_reports;
create policy tradarr_reports_member_insert on public.tradarr_safety_reports
 for insert to authenticated with check(reporter_id=(select auth.uid())
 and status='open' and staff_note is null and handled_by is null and handled_at is null);

create or replace function trade_private.tradarr_validate_member_report()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_user uuid;
begin
 if (select auth.uid()) is distinct from new.reporter_id then
  raise exception 'Report owner must match the signed-in user' using errcode='42501';
 end if;
 if new.target_type in ('user','trader') then
  if new.target_ref !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Invalid profile identifier' using errcode='22023';end if;
  target_user:=new.target_ref::uuid;
  if not exists(select 1 from auth.users where id=target_user) then
   raise exception 'Target account not found' using errcode='22023';
  end if;
  if new.target_type='trader' and not exists(select 1 from public.tradesperson_profiles where user_id=target_user) then
   raise exception 'Trade profile not found' using errcode='22023';
  end if;
  if target_user=new.reporter_id then raise exception 'Cannot report yourself' using errcode='23514';end if;
 elsif new.target_type='review' then
  if not (
   exists(select 1 from public.job_reviews where id::text=new.target_ref)
   or exists(select 1 from public.market_job_reviews where id::text=new.target_ref)
  ) then raise exception 'Review not found' using errcode='22023';end if;
 elsif new.target_type='job' then
  if not (
   exists(select 1 from public.jobs j where j.id::text=new.target_ref
     and new.reporter_id in (j.customer_id,j.accepted_tradesperson_id))
   or exists(select 1 from public.urgent_requests u where u.id::text=new.target_ref
     and new.reporter_id in (u.customer_id,u.accepted_tradesperson_id))
  ) then raise exception 'Job not found for your account' using errcode='22023';end if;
 elsif new.target_type='conversation' then
  if not exists(select 1 from public.conversations c where c.id::text=new.target_ref
    and new.reporter_id in (c.customer_id,c.tradesperson_id)) then
     raise exception 'Conversation not found for your account' using errcode='22023';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.reporter_id::text,3091));
 if (select count(*) from public.tradarr_safety_reports r
   where r.reporter_id=new.reporter_id and r.created_at>now()-interval '24 hours')>=10 then
  raise exception 'Too many reports submitted today; contact support' using errcode='23514';
 end if;
 new.created_at:=now();return new;
end $$;
revoke all on function trade_private.tradarr_validate_member_report() from public,anon,authenticated;
drop trigger if exists tradarr_validate_member_report on public.tradarr_safety_reports;
create trigger tradarr_validate_member_report before insert on public.tradarr_safety_reports
 for each row execute function trade_private.tradarr_validate_member_report();

create table if not exists public.tradarr_moderation_appeals(
 id uuid primary key default gen_random_uuid(),
 appellant_id uuid not null references auth.users(id) on delete cascade,
 topic text not null check(topic in ('account_suspension','trade_listing','review_moderation','other')),
 linked_id text,
 explanation text not null check(char_length(btrim(explanation)) between 20 and 3000),
 status text not null default 'open' check(status in ('open','reviewing','upheld','declined')),
 decision_note text check(decision_note is null or char_length(decision_note)<=2000),
 decided_by uuid references auth.users(id),
 decided_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.tradarr_moderation_appeals enable row level security;
revoke all on public.tradarr_moderation_appeals from public,anon;
grant select,insert on public.tradarr_moderation_appeals to authenticated;
drop policy if exists tradarr_appeals_owner_or_staff_read on public.tradarr_moderation_appeals;
create policy tradarr_appeals_owner_or_staff_read on public.tradarr_moderation_appeals
 for select to authenticated using(appellant_id=(select auth.uid())
 or (select trade_private.tradarr_staff_authorised()));
drop policy if exists tradarr_appeals_owner_submit on public.tradarr_moderation_appeals;
create policy tradarr_appeals_owner_submit on public.tradarr_moderation_appeals
 for insert to authenticated with check(appellant_id=(select auth.uid())
  and status='open' and decision_note is null and decided_by is null and decided_at is null);
create unique index if not exists tradarr_one_pending_topic_appeal
 on public.tradarr_moderation_appeals(appellant_id,topic) where status in ('open','reviewing');

create table if not exists public.tradarr_account_deletion_requests(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 reason text check(reason is null or char_length(reason)<=1500),
 status text not null default 'requested' check(status in ('requested','reviewing','ready_for_deletion','completed','declined')),
 resolution_note text check(resolution_note is null or char_length(resolution_note)<=2000),
 handled_by uuid references auth.users(id),
 handled_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists tradarr_one_pending_account_deletion
 on public.tradarr_account_deletion_requests(user_id) where status in ('requested','reviewing','ready_for_deletion');
alter table public.tradarr_account_deletion_requests enable row level security;
revoke all on public.tradarr_account_deletion_requests from public,anon;
grant select,insert on public.tradarr_account_deletion_requests to authenticated;
drop policy if exists tradarr_deletion_owner_or_staff on public.tradarr_account_deletion_requests;
create policy tradarr_deletion_owner_or_staff on public.tradarr_account_deletion_requests
 for select to authenticated using(user_id=(select auth.uid())
  or (select trade_private.tradarr_staff_authorised()));
drop policy if exists tradarr_deletion_request_own on public.tradarr_account_deletion_requests;
create policy tradarr_deletion_request_own on public.tradarr_account_deletion_requests
 for insert to authenticated with check(user_id=(select auth.uid())
  and status='requested' and resolution_note is null and handled_by is null and handled_at is null);

-- Immutable member reports, appeals and deletion requests; privileged RPCs exclusively handle decisions.
create or replace function public.tradarr_admin_case_decision(
 p_kind text,p_id uuid,p_status text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior text;affected integer;
begin
 if (select auth.uid()) is null or not (select trade_private.tradarr_staff_authorised()) then
  raise exception 'Staff and MFA required' using errcode='42501';end if;
 if p_id is null or char_length(btrim(coalesce(p_reason,'')))<12 or char_length(p_reason)>2000 then
  raise exception 'Case ID and 12-character reason required' using errcode='22023';end if;
 if p_kind='report' and p_status in ('reviewing','resolved','dismissed') then
  select status into prior from public.tradarr_safety_reports where id=p_id for update;
  if prior is null then raise exception 'Report not found' using errcode='22023';end if;
  if prior in ('resolved','dismissed') or prior=p_status then
   raise exception 'Report already decided' using errcode='23514';end if;
  update public.tradarr_safety_reports set status=p_status,staff_note=btrim(p_reason),
   handled_by=(select auth.uid()),handled_at=now() where id=p_id;
 elsif p_kind='appeal' and p_status in ('reviewing','upheld','declined') then
  select status into prior from public.tradarr_moderation_appeals where id=p_id for update;
  if prior is null then raise exception 'Appeal not found' using errcode='22023';end if;
  if prior in ('upheld','declined') or prior=p_status then
   raise exception 'Appeal already decided' using errcode='23514';end if;
  update public.tradarr_moderation_appeals set status=p_status,decision_note=btrim(p_reason),
   decided_by=(select auth.uid()),decided_at=now() where id=p_id;
  insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
    select appellant_id,'appeal:'||p_id||':'||p_status,'support_update',
     'Your moderation appeal was updated',
     'Your appeal is now marked '||replace(p_status,'_',' ')||'. Open Account Safety to read the decision.',
     jsonb_build_object('screen','accountSafety','appealId',p_id)
     from public.tradarr_moderation_appeals where id=p_id
    on conflict(recipient_id,event_key) do nothing;
 elsif p_kind='deletion' and p_status in ('reviewing','ready_for_deletion','declined') then
  select status into prior from public.tradarr_account_deletion_requests where id=p_id for update;
  if prior is null then raise exception 'Deletion request not found' using errcode='22023';end if;
  if prior in ('completed','declined') or prior=p_status then
   raise exception 'Deletion request already decided' using errcode='23514';end if;
  update public.tradarr_account_deletion_requests set status=p_status,resolution_note=btrim(p_reason),
   handled_by=(select auth.uid()),handled_at=now(),updated_at=now() where id=p_id;
 else raise exception 'Unsupported case decision' using errcode='22023';end if;
 insert into public.tradarr_admin_audit(actor_id,action,target_type,target_id,reason,metadata)
 values((select auth.uid()),p_kind||'_'||p_status,p_kind,p_id,btrim(p_reason),
  jsonb_build_object('previous',prior,'new',p_status));
 return jsonb_build_object('kind',p_kind,'id',p_id,'status',p_status);
end $$;
revoke all on function public.tradarr_admin_case_decision(text,uuid,text,text) from public,anon;
grant execute on function public.tradarr_admin_case_decision(text,uuid,text,text) to authenticated;
