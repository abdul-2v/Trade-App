-- Remind professionals about private diary entries, and both sides about marketplace bookings.
-- Idempotency is anchored to each appointment and its current start time.
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
 left join public.jobs j on j.id=a.job_id
 cross join lateral (values
  ('24h',interval '23 hours 50 minutes',interval '24 hours 5 minutes'),
  ('1h',interval '45 minutes',interval '65 minutes')) as rw(label,lower_bound,upper_bound)
 cross join lateral (values
  (case when j.id is not null then j.customer_id else null end),
  (a.tradesperson_id)) as person(recipient_id)
 where a.status='scheduled' and a.starts_at>now()
   and (a.job_id is null or j.status in ('accepted','en_route','arrived'))
   and a.starts_at between now()+rw.lower_bound and now()+rw.upper_bound
   and person.recipient_id is not null
 on conflict(recipient_id,event_key) do nothing;
end $$;
revoke all on function trade_private.tradarr_send_appointment_reminders() from public,anon,authenticated;