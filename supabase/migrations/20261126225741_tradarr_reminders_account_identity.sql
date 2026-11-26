CREATE OR REPLACE FUNCTION trade_private.tradarr_send_appointment_reminders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 update public.jobs set status='expired',updated_at=now() where status in ('posted','offered') and accepted_tradesperson_id is null and (flexible_deadline<=now() or requested_end<=now());
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 select distinct person.recipient_id,'appointment-reminder:'||a.id||':'||rw.label||':'||extract(epoch from a.starts_at)::bigint,
 'appointment_reminder',case rw.label when '24h' then 'Booking tomorrow' else 'Appointment coming up' end,
 case rw.label when '24h' then 'Your confirmed Tradarr appointment is tomorrow.' else 'Your confirmed Tradarr appointment starts in around one hour.' end,
 jsonb_build_object('screen',case when person.recipient_id=coalesce(j.customer_id,g.customer_id) then 'requests' else 'tradeDiary' end,'jobId',j.id,'appointmentId',a.id,'gridRequestId',g.id)
 from public.trade_appointments a left join public.jobs j on j.id=a.job_id left join public.trade_grid_requests g on g.id=a.grid_request_id
 cross join lateral (values ('24h',interval '23 hours 50 minutes',interval '24 hours 5 minutes'),('1h',interval '45 minutes',interval '65 minutes')) rw(label,lower_bound,upper_bound)
 cross join lateral (values (coalesce(j.customer_id,g.customer_id)),(a.tradesperson_id)) person(recipient_id)
 where a.status='scheduled' and a.starts_at>now() and (a.job_id is null or j.status in ('accepted','en_route','arrived')) and (a.grid_request_id is null or g.status='accepted')
 and a.starts_at between now()+rw.lower_bound and now()+rw.upper_bound and person.recipient_id is not null
 on conflict(recipient_id,event_key) do nothing;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 select r.tradesperson_id,'business-reminder:'||r.id||':'||r.due_on,'appointment_reminder','Business reminder due','Open Tradarr to review your due reminder.',jsonb_build_object('screen','tradeDiary','reminderId',r.id)
 from public.trade_suite_reminders r where r.status='due' and r.due_on<=(now() at time zone 'Europe/London')::date and not trade_private.tradarr_account_suspended(r.tradesperson_id)
 on conflict(recipient_id,event_key) do nothing;
end $function$
;
