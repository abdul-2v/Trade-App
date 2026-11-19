-- Customers cannot escalate their own case priority or assign staff.
-- Triage fields are written by trusted reviewers only.
create or replace function trade_private.tradarr_support_initialise_report()
returns trigger language plpgsql set search_path='' as $$
begin
 if (select auth.uid()) is distinct from new.submitted_by and
    current_user not in ('postgres','service_role') then
    raise exception 'Support case must belong to the submitting user'
      using errcode='42501';
 end if;
 if current_user not in ('postgres','service_role') then
   new.status:='open';
   new.priority:='normal';
   new.assigned_to:=null;
   new.resolution_note:=null;
   new.resolved_at:=null;
 end if;
 new.created_at:=now();
 new.updated_at:=now();
 return new;
end $$;
revoke all on function trade_private.tradarr_support_initialise_report() from public,anon,authenticated;
drop trigger if exists tradarr_support_initialise_report on public.support_requests;
create trigger tradarr_support_initialise_report
 before insert on public.support_requests for each row
 execute function trade_private.tradarr_support_initialise_report();

-- Server-owned timestamps; no one can silently reassign case/update authorship.
create or replace function trade_private.tradarr_support_message_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if (select auth.uid()) is distinct from new.author_id and
   current_user not in ('postgres','service_role') then
  raise exception 'Message author must match signed-in account' using errcode='42501';
 end if;
 new.created_at:=now();
 return new;
end $$;
revoke all on function trade_private.tradarr_support_message_guard() from public,anon,authenticated;
drop trigger if exists tradarr_support_message_guard on public.support_case_updates;
create trigger tradarr_support_message_guard
 before insert on public.support_case_updates for each row
 execute function trade_private.tradarr_support_message_guard();
;
