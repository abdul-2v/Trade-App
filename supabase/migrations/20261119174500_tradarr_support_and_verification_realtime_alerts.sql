-- Safe, recipient-specific Activity alerts for moderation outcomes.
alter table public.tradarr_notifications
 drop constraint if exists tradarr_notifications_kind_check;
alter table public.tradarr_notifications add constraint tradarr_notifications_kind_check
 check(kind in ('message','job_offer','job_accepted','job_status',
 'appointment','appointment_change','route_match','quote_update',
 'appointment_reminder','invoice_update','verification_update','support_update'));

create or replace function trade_private.tradarr_verification_outcome_alert()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status is not distinct from old.status then return null; end if;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(
  new.tradesperson_id,
  'verification:'||new.id||':'||new.status,
  'verification_update',
  case new.status when 'approved' then 'Credential approved'
    when 'rejected' then 'Credential not approved'
    when 'revoked' then 'Credential approval withdrawn'
    else 'Credential review update' end,
  'Your '||new.kind||' evidence is now '||replace(new.status,'_',' ')||'. Open Credentials & verification for details.',
  jsonb_build_object('screen','tradeTrust','credentialId',new.id)
 ) on conflict(recipient_id,event_key) do nothing;
 return null;
end $$;
revoke all on function trade_private.tradarr_verification_outcome_alert() from public,anon,authenticated;
drop trigger if exists tradarr_verification_outcome_alert on public.trade_credential_submissions;
create trigger tradarr_verification_outcome_alert
 after update of status on public.trade_credential_submissions for each row
 execute function trade_private.tradarr_verification_outcome_alert();

create or replace function trade_private.tradarr_support_reply_alert()
returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 if new.internal_only then return null; end if;
 select submitted_by into owner_id from public.support_requests where id=new.case_id;
 if owner_id is null or owner_id=new.author_id then return null; end if;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(owner_id,'support-reply:'||new.id,'support_update',
  'New update on your support case',
  'Tradarr support added a reply to your case. Open Help & support to read it.',
  jsonb_build_object('screen','support','caseId',new.case_id))
 on conflict(recipient_id,event_key) do nothing;
 return null;
end $$;
revoke all on function trade_private.tradarr_support_reply_alert() from public,anon,authenticated;
drop trigger if exists tradarr_support_reply_alert on public.support_case_updates;
create trigger tradarr_support_reply_alert
 after insert on public.support_case_updates for each row
 execute function trade_private.tradarr_support_reply_alert();

create or replace function trade_private.tradarr_support_status_alert()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status is not distinct from old.status then return null; end if;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(new.submitted_by,'support-status:'||new.id||':'||new.status,
  'support_update',
  'Support case updated',
  'Your support case status changed to '||replace(new.status,'_',' ')||'.',
  jsonb_build_object('screen','support','caseId',new.id))
 on conflict(recipient_id,event_key) do nothing;
 return null;
end $$;
revoke all on function trade_private.tradarr_support_status_alert() from public,anon,authenticated;
drop trigger if exists tradarr_support_status_alert on public.support_requests;
create trigger tradarr_support_status_alert after update of status on public.support_requests
 for each row execute function trade_private.tradarr_support_status_alert();
;
