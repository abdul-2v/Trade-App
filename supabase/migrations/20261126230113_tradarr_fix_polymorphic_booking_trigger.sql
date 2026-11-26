create or replace function trade_private.tradarr_provider_booking_alert()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_provider uuid;v_job uuid;v_key text;v_title text;v_body text;
begin
 if tg_table_name='jobs' then
  if tg_op='UPDATE' and new.status='cancelled' and old.status is distinct from new.status then
   v_provider:=new.accepted_tradesperson_id;v_job:=new.id;v_key:='job-cancelled-provider:'||new.id;v_title:='Booking cancelled';v_body:='A customer booking was cancelled. Check your diary.';
  end if;
 elsif tg_table_name='trade_appointments' then
  if tg_op='INSERT' and new.job_id is not null and new.status='scheduled' then
   v_provider:=new.tradesperson_id;v_job:=new.job_id;v_key:='booking-confirmed-provider:'||new.id;v_title:='Booking confirmed';v_body:='A confirmed job has been added to your diary.';
  end if;
 end if;
 if v_provider is not null then
  insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data) values(v_provider,v_key,'appointment',v_title,v_body,jsonb_build_object('screen','tradeDiary','jobId',v_job)) on conflict(recipient_id,event_key) do nothing;
 end if;
 return null;
end $$;
revoke all on function trade_private.tradarr_provider_booking_alert() from public,anon,authenticated;
