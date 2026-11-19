-- Customer-visible case history and a staff-only triage queue.
alter table public.support_requests add column if not exists priority text not null default 'normal';
alter table public.support_requests add column if not exists assigned_to uuid references auth.users(id);
alter table public.support_requests add column if not exists resolution_note text;
alter table public.support_requests add column if not exists resolved_at timestamptz;
alter table public.support_requests drop constraint if exists support_requests_priority_check;
alter table public.support_requests add constraint support_requests_priority_check
 check(priority in ('normal','high','urgent'));
alter table public.support_requests drop constraint if exists support_requests_status_check;
alter table public.support_requests add constraint support_requests_status_check
 check(status in ('open','in_progress','resolved','closed'));
alter table public.support_requests add constraint support_requests_resolution_note_size
 check(resolution_note is null or char_length(resolution_note)<=3000);
create index if not exists tradarr_support_triage_idx
  on public.support_requests(status,priority,created_at);
alter table public.support_requests enable row level security;
grant select,insert,update on public.support_requests to authenticated;
drop policy if exists support_requests_staff_read on public.support_requests;
create policy support_requests_staff_read on public.support_requests
 for select to authenticated using (
  (select auth.jwt()->'app_metadata'->>'tradarr_staff')='true'
 );
drop policy if exists support_requests_staff_update on public.support_requests;
create policy support_requests_staff_update on public.support_requests
 for update to authenticated
 using ((select auth.jwt()->'app_metadata'->>'tradarr_staff')='true')
 with check ((select auth.jwt()->'app_metadata'->>'tradarr_staff')='true');

create or replace function trade_private.tradarr_support_staff_update_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if current_user not in ('postgres','service_role') and
    (select auth.jwt()->'app_metadata'->>'tradarr_staff') is distinct from 'true' then
  raise exception 'Only authorised support staff can manage cases' using errcode='42501';
 end if;
 if (to_jsonb(new)-'status'-'priority'-'assigned_to'-'resolution_note'-'resolved_at'-'updated_at')
    is distinct from
    (to_jsonb(old)-'status'-'priority'-'assigned_to'-'resolution_note'-'resolved_at'-'updated_at') then
  raise exception 'Reported case details cannot be overwritten' using errcode='42501';
 end if;
 if new.status in ('resolved','closed') and new.resolution_note is null then
  raise exception 'Record a case outcome before resolving' using errcode='23514';
 end if;
 if new.status in ('resolved','closed') and old.status not in ('resolved','closed') then
  new.resolved_at:=now();
 elsif new.status in ('open','in_progress') then
  new.resolved_at:=null;
 end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function trade_private.tradarr_support_staff_update_guard() from public,anon,authenticated;
drop trigger if exists tradarr_support_staff_update_guard on public.support_requests;
create trigger tradarr_support_staff_update_guard
 before update on public.support_requests for each row
 execute function trade_private.tradarr_support_staff_update_guard();

create table if not exists public.support_case_updates (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.support_requests(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 message text not null check (char_length(btrim(message)) between 2 and 3000),
 internal_only boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists support_case_updates_case_idx
 on public.support_case_updates(case_id,created_at);
alter table public.support_case_updates enable row level security;
revoke all on public.support_case_updates from public,anon;
grant select,insert on public.support_case_updates to authenticated;
drop policy if exists support_case_updates_participant_read on public.support_case_updates;
create policy support_case_updates_participant_read on public.support_case_updates
 for select to authenticated using (
 (select auth.jwt()->'app_metadata'->>'tradarr_staff')='true'
 or (
  not internal_only and exists(select 1 from public.support_requests s
   where s.id=support_case_updates.case_id and s.submitted_by=(select auth.uid()))
 )
 );
drop policy if exists support_case_updates_participant_post on public.support_case_updates;
create policy support_case_updates_participant_post on public.support_case_updates
 for insert to authenticated with check (
 author_id=(select auth.uid()) and (
  (select auth.jwt()->'app_metadata'->>'tradarr_staff')='true'
  or (
   not internal_only and exists(select 1 from public.support_requests s
     where s.id=support_case_updates.case_id and s.submitted_by=(select auth.uid())
       and s.status in ('open','in_progress'))
  )
 )
 );
;
