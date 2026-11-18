-- Tradarr appointment, quote and status alert enhancements.
alter table public.tradarr_notifications drop constraint if exists tradarr_notifications_kind_check;
alter table public.tradarr_notifications add constraint tradarr_notifications_kind_check
 check(kind in ('message','job_offer','job_accepted','job_status','appointment',
 'appointment_change','route_match','quote_update','appointment_reminder'));

create or replace function trade_private.tradarr_quote_activity_alert()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_recipient uuid;v_key text;v_title text;v_body text;
begin
 if tg_op='INSERT' then
  v_recipient:=new.customer_id;v_key:='quote-delivered:'||new.id;
  v_title:='New quotation received';v_body:='A tradesperson sent you a quotation. Review it in Quote Centre.';
 elsif tg_op='UPDATE' and new.decision is distinct from old.decision and
 new.decision in ('accepted','declined','changes_requested') then
  v_recipient:=new.tradesperson_id;v_key:='quote-decision:'||new.id||':'||new.decision;
  v_title:=case new.decision when 'accepted' then 'Quotation accepted'
  when 'declined' then 'Quotation declined' else 'Quotation changes requested' end;
  v_body:='Your customer responded to a quotation in Tradarr.';
 end if;
 if v_recipient is not null then
  insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
   values(v_recipient,v_key,'quote_update',v_title,v_body,jsonb_build_object(
    'screen',case when tg_op='INSERT' then 'quotes' else 'tradeQuotes' end,
    'jobId',new.job_id,'quoteId',new.quote_id))
   on conflict(recipient_id,event_key) do nothing;
 end if;
 return null;
end $$;
revoke all on function trade_private.tradarr_quote_activity_alert() from public,anon,authenticated;
drop trigger if exists tradarr_quote_activity_alert on public.trade_customer_proposals;
create trigger tradarr_quote_activity_alert after insert or update of decision
 on public.trade_customer_proposals for each row execute function trade_private.tradarr_quote_activity_alert();

create or replace function trade_private.tradarr_provider_booking_alert()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_provider uuid;v_job uuid;v_key text;v_title text;v_body text;
begin
 if tg_table_name='jobs' and tg_op='UPDATE' and new.status='cancelled'
 and old.status is distinct from new.status then
  v_provider:=new.accepted_tradesperson_id;v_job:=new.id;
  v_key:='job-cancelled-provider:'||new.id;v_title:='Booking cancelled';
  v_body:='A customer booking was cancelled. Check your diary.';
 elsif tg_table_name='trade_appointments' and tg_op='INSERT'
 and new.job_id is not null and new.status='scheduled' then
  v_provider:=new.tradesperson_id;v_job:=new.job_id;
  v_key:='booking-confirmed-provider:'||new.id;v_title:='Booking confirmed';
  v_body:='A confirmed job has been added to your diary.';
 end if;
 if v_provider is not null then
  insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
   values(v_provider,v_key,'appointment',v_title,v_body,
   jsonb_build_object('screen','tradeDiary','jobId',v_job))
   on conflict(recipient_id,event_key) do nothing;
 end if;
 return null;
end $$;
revoke all on function trade_private.tradarr_provider_booking_alert() from public,anon,authenticated;
drop trigger if exists tradarr_provider_job_cancelled on public.jobs;
create trigger tradarr_provider_job_cancelled after update of status on public.jobs
 for each row execute function trade_private.tradarr_provider_booking_alert();
drop trigger if exists tradarr_provider_booking_confirmed on public.trade_appointments;
create trigger tradarr_provider_booking_confirmed after insert on public.trade_appointments
 for each row execute function trade_private.tradarr_provider_booking_alert();

create or replace function trade_private.tradarr_send_appointment_reminders()
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 select person.recipient_id,
  'appointment-reminder:'||a.id||':'||rw.label||':'||extract(epoch from a.starts_at)::bigint,
  'appointment_reminder',
  case rw.label when '24h' then 'Booking tomorrow' else 'Appointment coming up' end,
  case rw.label when '24h' then 'Your confirmed Tradarr appointment is tomorrow.'
       else 'Your confirmed Tradarr appointment starts in around one hour.' end,
  jsonb_build_object('screen',case when person.recipient_id=j.customer_id
    then 'requests' else 'tradeDiary' end,'jobId',j.id)
 from public.trade_appointments a
 join public.jobs j on j.id=a.job_id and j.status in ('accepted','en_route','arrived')
 cross join lateral (values
  ('24h',interval '23 hours 50 minutes',interval '24 hours 5 minutes'),
  ('1h',interval '45 minutes',interval '65 minutes')) as rw(label,lower_bound,upper_bound)
 cross join lateral (values (j.customer_id),(j.accepted_tradesperson_id)) as person(recipient_id)
 where a.status='scheduled' and a.starts_at>now()
 and a.starts_at between now()+rw.lower_bound and now()+rw.upper_bound
 and person.recipient_id is not null
 on conflict(recipient_id,event_key) do nothing;
end $$;
revoke all on function trade_private.tradarr_send_appointment_reminders() from public,anon,authenticated;
select cron.schedule('tradarr-booking-reminders-5min','*/5 * * * *',
 $$select trade_private.tradarr_send_appointment_reminders()$$);
