
-- Tradarr server-originated in-app notifications + dormant iOS-ready push device registry.
create table if not exists public.tradarr_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null,
 kind text not null check (kind in
  ('message','job_offer','job_accepted','job_status','appointment','appointment_change','route_match')),
 title text not null check (char_length(title) between 1 and 100),
 body text not null check (char_length(body) between 1 and 350),
 data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object'),
 read_at timestamptz,
 created_at timestamptz not null default now(),
 unique (recipient_id,event_key)
);
create index if not exists tradarr_notifications_unread_idx
 on public.tradarr_notifications(recipient_id,created_at desc) where read_at is null;
create index if not exists tradarr_notifications_latest_idx
 on public.tradarr_notifications(recipient_id,created_at desc);
alter table public.tradarr_notifications enable row level security;
drop policy if exists tradarr_notifications_self_read on public.tradarr_notifications;
create policy tradarr_notifications_self_read on public.tradarr_notifications
 for select to authenticated using(recipient_id=(select auth.uid()));
drop policy if exists tradarr_notifications_self_update on public.tradarr_notifications;
create policy tradarr_notifications_self_update on public.tradarr_notifications
 for update to authenticated using(recipient_id=(select auth.uid()))
 with check(recipient_id=(select auth.uid()));
grant select,update on public.tradarr_notifications to authenticated;

create or replace function trade_private.tradarr_notification_read_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and auth.uid() is not null then
  if row(new.id,new.recipient_id,new.event_key,new.kind,new.title,new.body,new.data,new.created_at)
    is distinct from
     row(old.id,old.recipient_id,old.event_key,old.kind,old.title,old.body,old.data,old.created_at)
    or (old.read_at is not null and new.read_at is distinct from old.read_at)
    or (old.read_at is null and new.read_at is null) then
    raise exception 'Only marking a notification read is allowed' using errcode='42501';
  end if;
  new.read_at:=now();
 end if;
 return new;
end $$;
drop trigger if exists tradarr_notification_read_guard on public.tradarr_notifications;
create trigger tradarr_notification_read_guard before update on public.tradarr_notifications
 for each row execute function trade_private.tradarr_notification_read_guard();

create table if not exists public.tradarr_push_devices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 expo_token text not null unique
   check (expo_token ~ '^(Expo|Exponent)PushToken\\[[A-Za-z0-9_-]+\\]$' and length(expo_token)<220),
 platform text not null check(platform in ('ios','android')),
 enabled boolean not null default true,
 last_seen_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index if not exists tradarr_push_devices_owner_idx on public.tradarr_push_devices(user_id);
alter table public.tradarr_push_devices enable row level security;
drop policy if exists tradarr_push_devices_owner_select on public.tradarr_push_devices;
create policy tradarr_push_devices_owner_select on public.tradarr_push_devices for select
 to authenticated using(user_id=(select auth.uid()));
drop policy if exists tradarr_push_devices_owner_insert on public.tradarr_push_devices;
create policy tradarr_push_devices_owner_insert on public.tradarr_push_devices for insert
 to authenticated with check(user_id=(select auth.uid()));
drop policy if exists tradarr_push_devices_owner_update on public.tradarr_push_devices;
create policy tradarr_push_devices_owner_update on public.tradarr_push_devices for update
 to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists tradarr_push_devices_owner_delete on public.tradarr_push_devices;
create policy tradarr_push_devices_owner_delete on public.tradarr_push_devices for delete
 to authenticated using(user_id=(select auth.uid()));
grant select,insert,update,delete on public.tradarr_push_devices to authenticated;

-- The outbox is internal-only: clients cannot forge a push alert or set delivery status.
create table if not exists public.tradarr_push_outbox (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null unique references public.tradarr_notifications(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending'
   check(status in ('pending','processing','retry','sent','skipped','failed')),
 attempts integer not null default 0 check(attempts between 0 and 10),
 next_attempt_at timestamptz not null default now(),
 processed_at timestamptz,
 last_error text,
 ticket_details jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists tradarr_push_outbox_pending_idx
 on public.tradarr_push_outbox(status,next_attempt_at) where status in ('pending','retry');
alter table public.tradarr_push_outbox enable row level security;
revoke all on public.tradarr_push_outbox from anon,authenticated;
grant select,insert,update on public.tradarr_push_outbox to service_role;

create or replace function trade_private.tradarr_enqueue_push()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.tradarr_push_outbox(notification_id,recipient_id)
 values(new.id,new.recipient_id) on conflict(notification_id) do nothing;
 return null;
end $$;
revoke all on function trade_private.tradarr_enqueue_push() from public,anon,authenticated;
drop trigger if exists tradarr_notification_to_outbox on public.tradarr_notifications;
create trigger tradarr_notification_to_outbox after insert on public.tradarr_notifications
 for each row execute function trade_private.tradarr_enqueue_push();

create or replace function trade_private.tradarr_emit_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 recipient uuid; kind text; heading text; description text; key text; metadata jsonb; related_job record;
begin
 recipient:=null;kind:=null;heading:=null;description:=null;key:=null;metadata:='{}'::jsonb;
 if tg_table_name='messages' and tg_op='INSERT' then
  select case when new.sender_id=c.customer_id then c.tradesperson_id
              when new.sender_id=c.tradesperson_id then c.customer_id
              else null end
    into recipient from public.conversations c where c.id=new.conversation_id;
  kind:='message';heading:='New message';description:='You have a new message in Tradarr.';
  key:='message:'||new.id;metadata:=jsonb_build_object('screen','messages','conversationId',new.conversation_id);
 elsif tg_table_name='job_offers' then
  if tg_op='INSERT' and new.status='offered' then
   recipient:=new.tradesperson_id;
   kind:='job_offer';heading:='New job request';
   description:='A customer sent you a job request. Tap to review.';
   key:='offer:'||new.id;metadata:=jsonb_build_object('screen','tradeJobs','jobId',new.job_id);
  elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='accepted' then
   select j.customer_id into recipient from public.jobs j where j.id=new.job_id;
   kind:='job_accepted';heading:='Job request accepted';
   description:='A tradesperson accepted your request. Open Tradarr for the details.';
   key:='offer-accepted:'||new.id;metadata:=jsonb_build_object('screen','requests','jobId',new.job_id);
  end if;
 elsif tg_table_name='jobs' and tg_op='UPDATE' then
  if old.status is distinct from new.status and
    new.status in ('en_route','arrived','completed','cancelled') then
   kind:='job_status';recipient:=new.customer_id;
   heading:=case new.status when 'en_route' then 'Tradesperson on the way'
     when 'arrived' then 'Tradesperson has arrived'
     when 'completed' then 'Job marked completed'
     else 'Job request cancelled' end;
   description:='Your Tradarr job has an update. Open the app to view it.';
   key:='job-status:'||new.id||':'||new.status;
   metadata:=jsonb_build_object('screen','requests','jobId',new.id);
  end if;
 elsif tg_table_name='trade_appointment_changes' then
  select j.customer_id,j.accepted_tradesperson_id
   into related_job from public.jobs j where j.id=new.job_id;
  if found then
   if tg_op='INSERT' and new.status='pending' then
    recipient:=case when new.proposer_id=related_job.customer_id
      then related_job.accepted_tradesperson_id else related_job.customer_id end;
    kind:='appointment_change';heading:='New appointment time proposed';
    description:='Review a suggested appointment time in Tradarr.';
    key:='appointment-proposed:'||new.id;
   elsif tg_op='UPDATE' and new.status is distinct from old.status
      and new.status in ('accepted','declined') then
    recipient:=new.proposer_id;kind:='appointment_change';
    heading:=case when new.status='accepted' then 'Appointment time agreed'
       else 'Time change declined' end;
    description:='An appointment proposal has been updated.';
    key:='appointment-response:'||new.id||':'||new.status;
   end if;
   metadata:=jsonb_build_object('screen','requests','jobId',new.job_id);
  end if;
 elsif tg_table_name='trade_appointments' and tg_op='INSERT' then
  if new.job_id is not null and new.status='scheduled' then
   select j.customer_id into recipient from public.jobs j where j.id=new.job_id;
   kind:='appointment';heading:='Appointment confirmed';
   description:='Your booking time has been confirmed in Tradarr.';
   key:='appointment-created:'||new.id;
   metadata:=jsonb_build_object('screen','requests','jobId',new.job_id);
  end if;
 end if;
 if recipient is not null and kind is not null then
  insert into public.tradarr_notifications(recipient_id,event_key,kind,title,body,data)
  values(recipient,key,kind,heading,description,metadata)
  on conflict(recipient_id,event_key) do nothing;
 end if;
 return null;
end $$;
revoke all on function trade_private.tradarr_emit_notification() from public,anon,authenticated;
drop trigger if exists tradarr_notify_new_message on public.messages;
create trigger tradarr_notify_new_message after insert on public.messages
 for each row execute function trade_private.tradarr_emit_notification();
drop trigger if exists tradarr_notify_job_offer on public.job_offers;
create trigger tradarr_notify_job_offer after insert or update of status on public.job_offers
 for each row execute function trade_private.tradarr_emit_notification();
drop trigger if exists tradarr_notify_job_status on public.jobs;
create trigger tradarr_notify_job_status after update of status on public.jobs
 for each row execute function trade_private.tradarr_emit_notification();
drop trigger if exists tradarr_notify_booking_changes on public.trade_appointment_changes;
create trigger tradarr_notify_booking_changes after insert or update of status on public.trade_appointment_changes
 for each row execute function trade_private.tradarr_emit_notification();
drop trigger if exists tradarr_notify_booking_confirmed on public.trade_appointments;
create trigger tradarr_notify_booking_confirmed after insert on public.trade_appointments
 for each row execute function trade_private.tradarr_emit_notification();

do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
       and schemaname='public' and tablename='tradarr_notifications') then
  alter publication supabase_realtime add table public.tradarr_notifications;
 end if;
end $$;

