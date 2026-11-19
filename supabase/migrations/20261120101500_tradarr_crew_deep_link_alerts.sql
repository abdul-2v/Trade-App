-- Include the private application identifier in recipient-specific Crew alerts.
-- The identifier is a navigation hint only; row-level security protects the thread.
create or replace function trade_private.crew_send_notification()
returns trigger language plpgsql security definer set search_path='' as $crew$
declare v_to uuid;v_title text;v_body text;v_key text;v_owner uuid;v_application uuid;
begin
 if tg_table_name='crew_applications' then
  v_application:=new.id;
  select owner_id into v_owner from public.crew_requests where id=new.request_id;
  if tg_op='INSERT' then
   v_to:=v_owner;v_title:='New Crew application';v_body:='Someone has applied to help with your Crew request.';
   v_key:='crew-application:'||new.id::text;
  elsif new.status is distinct from old.status then
   v_to:=case when new.status='withdrawn' then v_owner else new.worker_id end;
   v_title:='Crew application updated';v_body:='Your Crew application has a new status: '||new.status||'.';
   v_key:='crew-status:'||new.id::text||':'||new.status;
  end if;
 elsif tg_table_name='crew_messages' then
  v_application:=new.application_id;
  select r.owner_id,a.worker_id into v_owner,v_to
   from public.crew_applications a join public.crew_requests r on r.id=a.request_id
   where a.id=new.application_id;
  v_to:=case when new.sender_id=v_owner then v_to else v_owner end;
  v_title:='New Crew message';v_body:='You have a message about a Crew opportunity.';
  v_key:='crew-message:'||new.id::text;
 end if;
 if v_to is not null and v_to<>(select auth.uid()) then
  insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
  values(v_to,v_key,'crew_update',v_title,v_body,
   jsonb_build_object('screen','tradeCrew','applicationId',v_application))
  on conflict(recipient_id,event_key) do nothing;
 end if;
 return new;
end;
$crew$;
