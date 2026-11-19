-- Include stable application IDs so both Crew and trader Inbox can open the right conversation.
-- No personal message bodies are sent to push providers.
create or replace function trade_private.crew_send_notification()
returns trigger language plpgsql security definer set search_path='' as $crew$
declare
 v_to uuid;
 v_owner uuid;
 v_worker uuid;
 v_request uuid;
 v_title text;
 v_body text;
 v_key text;
 v_meta jsonb;
begin
 if tg_table_name='crew_applications' then
  select owner_id into v_owner from public.crew_requests where id=new.request_id;
  v_request:=new.request_id;
  if tg_op='INSERT' then
   v_to:=v_owner;
   v_title:='New Crew application';
   v_body:='Someone has applied to help with your Crew request.';
   v_key:='crew-application:'||new.id::text;
  elsif old.status is distinct from new.status then
   v_to:=case when new.status='withdrawn' then v_owner else new.worker_id end;
   v_title:='Crew application updated';
   v_body:='Your Crew application has a new status: '||new.status||'.';
   v_key:='crew-status:'||new.id::text||':'||new.status;
  end if;
  v_meta:=jsonb_build_object('screen','tradeCrew','applicationId',new.id,'requestId',v_request);
 elsif tg_table_name='crew_messages' and tg_op='INSERT' then
  select r.owner_id,a.worker_id,r.id into v_owner,v_worker,v_request
   from public.crew_applications a
   join public.crew_requests r on r.id=a.request_id where a.id=new.application_id;
  v_to:=case when new.sender_id=v_owner then v_worker else v_owner end;
  v_title:='New Crew message';
  v_body:='You have a message about a Crew opportunity.';
  v_key:='crew-message:'||new.id::text;
  v_meta:=jsonb_build_object('screen','tradeCrew','applicationId',new.application_id,'requestId',v_request);
 end if;
 if v_to is not null and v_key is not null then
  insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
  values(v_to,v_key,'crew_update',v_title,v_body,v_meta)
  on conflict(recipient_id,event_key) do nothing;
 end if;
 return new;
end;
$crew$;
revoke all on function trade_private.crew_send_notification() from public,anon,authenticated;
