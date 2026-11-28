-- Shared transaction email outbox. Off until the owner verifies a sender and enables delivery.
create table trade_private.tradarr_email_control (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into trade_private.tradarr_email_control(singleton,enabled) values(true,false);
alter table trade_private.tradarr_email_control enable row level security;
revoke all on trade_private.tradarr_email_control from public,anon,authenticated,service_role;

create table public.tradarr_email_preferences(
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 booking_updates boolean not null default true,
 job_updates boolean not null default true,
 document_updates boolean not null default true,
 message_reminders boolean not null default false,
 opportunity_updates boolean not null default false
);
alter table public.tradarr_email_preferences enable row level security;
revoke all on public.tradarr_email_preferences from public,anon,authenticated;
grant select,insert,update on public.tradarr_email_preferences to authenticated;
create policy tradarr_email_preferences_own on public.tradarr_email_preferences
 for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table trade_private.tradarr_email_suppression(
 recipient_id uuid primary key references auth.users(id) on delete cascade,
 reason text not null check(reason in ('bounce','complaint','operator')),
 created_at timestamptz not null default now()
);
alter table trade_private.tradarr_email_suppression enable row level security;
revoke all on trade_private.tradarr_email_suppression from public,anon,authenticated,service_role;

create table trade_private.tradarr_email_outbox(
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null unique references public.tradarr_notifications(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 kind text not null,
 dedupe_bucket text,
 status text not null default 'pending' check(status in ('pending','processing','retry','accepted','skipped','failed')),
 attempts int not null default 0 check(attempts between 0 and 6),
 next_attempt_at timestamptz not null default now(),
 lease_token uuid, lease_until timestamptz,
 first_attempt_at timestamptz,
 recipient_fingerprint text,
 provider_id text,
 last_code text,
 created_at timestamptz not null default now(),
 settled_at timestamptz,
 unique(recipient_id,dedupe_bucket)
);
alter table trade_private.tradarr_email_outbox enable row level security;
revoke all on trade_private.tradarr_email_outbox from public,anon,authenticated,service_role;
create index tradarr_email_outbox_ready on trade_private.tradarr_email_outbox(next_attempt_at) where status in ('pending','retry');
create index tradarr_email_outbox_recipient on trade_private.tradarr_email_outbox(recipient_id);
create index tradarr_email_outbox_lease on trade_private.tradarr_email_outbox(lease_until) where status='processing';

create function trade_private.tradarr_email_allowed(p_user uuid,p_kind text)
returns boolean language sql stable security definer set search_path='' as $$
 select case
 when p_kind in ('support_update','verification_update','admin_notice') then true
 when p_kind in ('appointment','appointment_change','appointment_reminder') then coalesce(p.booking_updates,true)
 when p_kind in ('job_accepted','job_status','crew_update') then coalesce(p.job_updates,true)
 when p_kind in ('quote_update','invoice_update') then coalesce(p.document_updates,true)
 when p_kind='message' then coalesce(p.message_reminders,false)
 when p_kind in ('job_offer','route_match') then coalesce(p.opportunity_updates,false)
 else false end
 from (select 1) seed left join public.tradarr_email_preferences p on p.user_id=p_user
$$;
revoke all on function trade_private.tradarr_email_allowed(uuid,text) from public,anon,authenticated,service_role;

create function trade_private.tradarr_enqueue_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare bucket text; delay_time interval:=interval '0';
begin
 if not exists(select 1 from trade_private.tradarr_email_control where enabled) then return null;end if;
 if not trade_private.tradarr_email_allowed(new.recipient_id,new.kind) then return null;end if;
 if new.kind='message' then
  bucket:='message:'||floor(extract(epoch from new.created_at)/1800)::bigint;
  delay_time:=interval '15 minutes';
 elsif new.kind in ('job_offer','route_match') then
  bucket:=new.kind||':'||floor(extract(epoch from new.created_at)/900)::bigint;
 end if;
 insert into trade_private.tradarr_email_outbox(notification_id,recipient_id,kind,dedupe_bucket,next_attempt_at)
 values(new.id,new.recipient_id,new.kind,bucket,now()+delay_time) on conflict do nothing;
 return null;
exception when others then
 -- An email failure must not roll back a customer's actual booking, invoice or chat.
 raise warning 'Tradarr email enqueue failed (SQLSTATE %)',sqlstate;
 return null;
end $$;
revoke all on function trade_private.tradarr_enqueue_email() from public,anon,authenticated,service_role;
create trigger tradarr_notification_to_email after insert on public.tradarr_notifications
 for each row execute function trade_private.tradarr_enqueue_email();

create function public.tradarr_claim_email_batch(p_limit int default 5)
returns table(outbox_id uuid,claim_token uuid,recipient_email text,event_kind text,attempt_number int)
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service only' using errcode='42501';end if;
 if not exists(select 1 from trade_private.tradarr_email_control where enabled) then return;end if;
 update trade_private.tradarr_email_outbox o set status='failed',settled_at=now(),last_code='retry_window_closed',lease_token=null,lease_until=null
 where (o.status in ('pending','retry') or (o.status='processing' and o.lease_until<=now()))
 and (o.attempts>=6 or o.created_at<now()-interval '12 hours');
 update trade_private.tradarr_email_outbox o set status='skipped',settled_at=now(),last_code='recipient_or_preference',lease_token=null,lease_until=null
 from auth.users u,public.tradarr_notifications n
 where o.recipient_id=u.id and n.id=o.notification_id
 and (o.status in ('pending','retry') or (o.status='processing' and o.lease_until<=now()))
 and (u.email is null or u.email_confirmed_at is null or u.deleted_at is not null
 or (o.recipient_fingerprint is not null and o.recipient_fingerprint<>md5(lower(u.email)))
 or not trade_private.tradarr_email_allowed(o.recipient_id,o.kind)
 or exists(select 1 from trade_private.tradarr_email_suppression x where x.recipient_id=o.recipient_id)
 or (o.kind in ('message','job_offer','route_match') and n.read_at is not null)
 or (o.kind='appointment_reminder' and o.created_at<now()-interval '30 minutes'));
 return query
 with ready as (
 select o.id from trade_private.tradarr_email_outbox o
 where ((o.status in ('pending','retry') and o.next_attempt_at<=now()) or (o.status='processing' and o.lease_until<=now()))
 and o.attempts<6 and o.created_at>=now()-interval '12 hours'
 order by o.next_attempt_at,o.id limit greatest(1,least(coalesce(p_limit,5),5)) for update skip locked
 ), claimed as (
 update trade_private.tradarr_email_outbox o set status='processing',attempts=o.attempts+1,
 lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',
 first_attempt_at=coalesce(o.first_attempt_at,now()),recipient_fingerprint=md5(lower(u.email))
 from ready r,auth.users u where o.id=r.id and u.id=o.recipient_id
 returning o.id,o.lease_token,u.email,o.kind,o.attempts
 ) select c.id,c.lease_token,c.email::text,c.kind,c.attempts from claimed c;
end $$;
revoke all on function public.tradarr_claim_email_batch(int) from public,anon,authenticated;
grant execute on function public.tradarr_claim_email_batch(int) to service_role;

create function public.tradarr_settle_email(p_id uuid,p_token uuid,p_status text,p_code text default null,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service only' using errcode='42501';end if;
 if p_status not in ('accepted','retry','failed','skipped') then raise exception 'Invalid settlement';end if;
 update trade_private.tradarr_email_outbox o set
 status=case when p_status='retry' and (o.attempts>=6 or o.created_at<now()-interval '12 hours') then 'failed' else p_status end,
 next_attempt_at=now()+make_interval(mins=>least(60,power(2,o.attempts)::int)),
 lease_token=null,lease_until=null,settled_at=now(),last_code=left(p_code,80),
 provider_id=case when p_status='accepted' then left(p_provider_id,100) else null end
 where o.id=p_id and o.lease_token=p_token and o.status='processing';
 return found;
end $$;
revoke all on function public.tradarr_settle_email(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.tradarr_settle_email(uuid,uuid,text,text,text) to service_role;

create function trade_private.tradarr_dispatch_email_http()
returns void language plpgsql security definer set search_path='' as $$
declare jwt text; worker_secret text;
begin
 if not exists(select 1 from trade_private.tradarr_email_control where enabled) then return;end if;
 if not exists(select 1 from trade_private.tradarr_email_outbox where status in ('pending','retry','processing')) then return;end if;
 select decrypted_secret into jwt from vault.decrypted_secrets where name='tradarr_push_anon_jwt' limit 1;
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='tradarr_email_dispatch_secret' limit 1;
 if coalesce(jwt,'')='' or coalesce(worker_secret,'')='' then return;end if;
 perform net.http_post(url:='https://sjwedfdwqxfrnpruiqnq.supabase.co/functions/v1/tradarr-email-dispatch',
 headers:=jsonb_build_object('content-type','application/json','authorization','Bearer '||jwt,'apikey',jwt,'x-tradarr-dispatch',worker_secret),
 body:='{}'::jsonb,timeout_milliseconds:=60000);
exception when others then raise warning 'Tradarr email dispatch unavailable (SQLSTATE %)',sqlstate;
end $$;
revoke all on function trade_private.tradarr_dispatch_email_http() from public,anon,authenticated,service_role;
select cron.schedule('tradarr-email-dispatch-5min','*/5 * * * *','select trade_private.tradarr_dispatch_email_http()');
