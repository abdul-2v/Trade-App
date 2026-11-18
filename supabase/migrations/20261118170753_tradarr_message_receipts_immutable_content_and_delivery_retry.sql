
-- Messages are immutable once sent; only the recipient may mark one read.
alter table public.messages add column if not exists client_token uuid;
create unique index if not exists tradarr_message_retry_token
 on public.messages(sender_id,client_token) where client_token is not null;
create index if not exists tradarr_messages_unread_by_thread
 on public.messages(conversation_id,sender_id,created_at)
 where read_at is null;
do $$ begin
 if not exists (select 1 from pg_constraint where conname='tradarr_messages_content_length') then
  alter table public.messages add constraint tradarr_messages_content_length
   check (length(btrim(body)) between 1 and 4000);
 end if;
end $$;
create or replace function trade_private.tradarr_message_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op='INSERT' then
   if new.sender_id is distinct from auth.uid() or new.read_at is not null then
    raise exception 'Only the sender may create a new unread message' using errcode='42501';
   end if;
 elsif tg_op='UPDATE' then
   if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at
    or new.client_token is distinct from old.client_token
   then
    raise exception 'Sent messages cannot be edited' using errcode='42501';
   end if;
   if old.sender_id=auth.uid() or old.read_at is not null or new.read_at is null then
    raise exception 'Only the recipient can mark an unread message read' using errcode='42501';
   end if;
   new.read_at := now();
 end if;
 return new;
end $$;
drop trigger if exists tradarr_guard_message on public.messages;
create trigger tradarr_guard_message before insert or update on public.messages
for each row execute function trade_private.tradarr_message_guard();
drop policy if exists messages_participants_update on public.messages;
drop policy if exists tradarr_messages_recipient_marks_read on public.messages;
create policy tradarr_messages_recipient_marks_read on public.messages
 for update to authenticated using (
  sender_id <> (select auth.uid()) and read_at is null and exists (
   select 1 from public.conversations c
   where c.id=conversation_id
     and ((select auth.uid())=c.customer_id or (select auth.uid())=c.tradesperson_id)
  )
 ) with check (
  sender_id <> (select auth.uid()) and exists (
   select 1 from public.conversations c
   where c.id=conversation_id
     and ((select auth.uid())=c.customer_id or (select auth.uid())=c.tradesperson_id)
  )
 );
grant select,insert,update on public.messages to authenticated;
create or replace function trade_private.tradarr_touch_conversation_on_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.conversations set updated_at = new.created_at where id = new.conversation_id;
 return null;
end $$;
revoke all on function trade_private.tradarr_touch_conversation_on_message() from public,anon,authenticated;
drop trigger if exists tradarr_touch_conversation_on_message on public.messages;
create trigger tradarr_touch_conversation_on_message after insert on public.messages
 for each row execute function trade_private.tradarr_touch_conversation_on_message();

