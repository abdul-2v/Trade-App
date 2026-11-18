
-- Claimed batches are only callable by the Edge Function's service role.
alter table public.tradarr_push_outbox
 add column if not exists receipt_checked_at timestamptz,
 add column if not exists receipt_details jsonb not null default '{}'::jsonb;

create or replace function public.tradarr_claim_push_batch(p_limit integer default 15)
returns table(
 outbox_id uuid, notification_id uuid, recipient_id uuid,
 title text, body text, kind text, payload jsonb, attempts integer, read_at timestamptz
)
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then
   raise exception 'Only the trusted notification delivery service may claim the outbox'
      using errcode='42501';
 end if;
 return query
 with candidates as(
  select o.id from public.tradarr_push_outbox o
  where ((o.status in ('pending','retry') and o.next_attempt_at<=now())
   or (o.status='processing' and o.processed_at<now()-interval '5 minutes'))
   and o.attempts < 5
  order by o.created_at
  limit greatest(1,least(coalesce(p_limit,15),25))
  for update skip locked
 ),
 claimed as(
  update public.tradarr_push_outbox o
   set status='processing',processed_at=now(),attempts=o.attempts+1
  from candidates c where o.id=c.id
  returning o.id,o.notification_id,o.recipient_id,o.attempts
 )
 select c.id,c.notification_id,c.recipient_id,n.title,n.body,n.kind,n.data,c.attempts,n.read_at
 from claimed c join public.tradarr_notifications n on n.id=c.notification_id;
end $$;
revoke all on function public.tradarr_claim_push_batch(integer) from public,anon,authenticated;
grant execute on function public.tradarr_claim_push_batch(integer) to service_role;

-- Freeze sensitive columns on authenticated push-device updates.
create or replace function trade_private.tradarr_push_device_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and auth.uid() is not null then
   if new.user_id is distinct from old.user_id or
      new.expo_token is distinct from old.expo_token or
      new.platform is distinct from old.platform or
      new.created_at is distinct from old.created_at then
      raise exception 'Push token ownership cannot be reassigned from the app'
      using errcode='42501';
   end if;
 end if;
 new.last_seen_at:=now();
 return new;
end $$;
drop trigger if exists tradarr_push_device_guard on public.tradarr_push_devices;
create trigger tradarr_push_device_guard before insert or update
on public.tradarr_push_devices for each row execute function trade_private.tradarr_push_device_guard();

