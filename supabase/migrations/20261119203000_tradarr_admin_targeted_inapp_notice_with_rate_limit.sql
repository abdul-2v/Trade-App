-- Direct in-app admin announcements, with an explicit audit and a daily cap.
alter table public.tradarr_notifications
 drop constraint if exists tradarr_notifications_kind_check;
alter table public.tradarr_notifications
 add constraint tradarr_notifications_kind_check
 check(kind in ('message','job_offer','job_accepted','job_status',
 'appointment','appointment_change','route_match','quote_update',
 'appointment_reminder','invoice_update','verification_update',
 'support_update','admin_notice'));

create or replace function public.tradarr_admin_notify_user(
 p_user_id uuid,p_title text,p_message text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare note_id uuid;
begin
 if (select auth.uid()) is null or not (select trade_private.tradarr_staff_authorised()) then
  raise exception 'Verified administrator and second factor required' using errcode='42501';
 end if;
 if p_user_id is null or not exists(select 1 from auth.users u where u.id=p_user_id) then
  raise exception 'Recipient account not found' using errcode='22023';
 end if;
 if char_length(btrim(coalesce(p_title,'')))<5 or char_length(p_title)>90
  or char_length(btrim(coalesce(p_message,'')))<10 or char_length(p_message)>350 then
  raise exception 'Notice title must be 5-90 characters; message 10-350 characters'
   using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended((select auth.uid())::text,5353));
 if (select count(*) from public.tradarr_admin_audit a
  where a.actor_id=(select auth.uid()) and a.action='admin_notice_sent'
   and a.created_at>now()-interval '1 day')>=30 then
  raise exception 'Daily administrator notice limit reached' using errcode='23514';
 end if;
 insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
 values(p_user_id,'admin-notice:'||gen_random_uuid()::text,'admin_notice',
  btrim(p_title),btrim(p_message),jsonb_build_object('screen','notifications'))
 returning id into note_id;
 insert into public.tradarr_admin_audit(actor_id,action,target_type,target_id,reason,metadata)
 values((select auth.uid()),'admin_notice_sent','user',p_user_id,
  'Notice: '||left(btrim(p_title),90),
  jsonb_build_object('notification_id',note_id,'message_length',char_length(p_message)));
 return note_id;
end $$;
revoke all on function public.tradarr_admin_notify_user(uuid,text,text) from public,anon;
grant execute on function public.tradarr_admin_notify_user(uuid,text,text) to authenticated;
