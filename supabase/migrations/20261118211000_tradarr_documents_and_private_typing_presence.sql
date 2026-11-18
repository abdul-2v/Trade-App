-- Tradarr: private PDF/Word attachments and expiring conversation typing state.
create table if not exists public.conversation_typing (
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 updated_at timestamptz not null default now(),
 primary key (conversation_id,user_id),
 constraint typing_expiry_reasonable check (expires_at <= updated_at + interval '30 seconds')
);
alter table public.conversation_typing enable row level security;
create policy typing_participants_read on public.conversation_typing for select to authenticated
 using (exists(select 1 from public.conversations c where c.id=conversation_id
 and ((select auth.uid())=c.customer_id or (select auth.uid())=c.tradesperson_id)));
create policy typing_self_insert on public.conversation_typing for insert to authenticated
 with check (user_id=(select auth.uid()) and expires_at > now()
 and exists(select 1 from public.conversations c where c.id=conversation_id
 and ((select auth.uid())=c.customer_id or (select auth.uid())=c.tradesperson_id)));
create policy typing_self_update on public.conversation_typing for update to authenticated
 using (user_id=(select auth.uid())) with check (user_id=(select auth.uid())
 and expires_at > now()
 and exists(select 1 from public.conversations c where c.id=conversation_id
 and ((select auth.uid())=c.customer_id or (select auth.uid())=c.tradesperson_id)));
grant select,insert,update on public.conversation_typing to authenticated;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
 and schemaname='public' and tablename='conversation_typing') then
 alter publication supabase_realtime add table public.conversation_typing; end if;
end $$;

-- Only 8 MB, in the existing participant-only chat bucket. Never use public URLs.
update storage.buckets set file_size_limit=8388608,
 allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
 where id='tradarr-chat';
alter table public.messages drop constraint if exists tradarr_attachment_type_check;
alter table public.messages add constraint tradarr_attachment_type_check check (
 (attachment_path is null and attachment_mime is null)
 or (attachment_path is not null and length(attachment_path) between 78 and 260
 and ( (attachment_mime='image/jpeg' and right(attachment_path,4)='.jpg')
 or (attachment_mime='image/png' and right(attachment_path,4)='.png')
 or (attachment_mime='image/webp' and right(attachment_path,5)='.webp')
 or (attachment_mime='application/pdf' and right(attachment_path,4)='.pdf')
 or (attachment_mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
     and right(attachment_path,5)='.docx'))));
create or replace function trade_private.tradarr_message_guard()
 returns trigger language plpgsql set search_path='' as $function$
begin
 if tg_op='INSERT' then
  if new.sender_id is distinct from auth.uid() or new.read_at is not null then
   raise exception 'Only the sender may create a new unread message' using errcode='42501';
  end if;
  if new.attachment_path is not null then
   if new.attachment_path not like new.conversation_id::text||'/'||new.sender_id::text||'/%'
    or not exists(select 1 from storage.objects o where o.bucket_id='tradarr-chat'
      and o.name=new.attachment_path and o.metadata->>'mimetype'=new.attachment_mime) then
    raise exception 'Attachment is not associated with your conversation' using errcode='42501';
   end if;
  end if;
 elsif tg_op='UPDATE' then
  if new.id is distinct from old.id or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at or new.client_token is distinct from old.client_token
    or new.attachment_path is distinct from old.attachment_path or new.attachment_mime is distinct from old.attachment_mime then
   raise exception 'Sent messages cannot be edited' using errcode='42501';
  end if;
  if old.sender_id=auth.uid() or old.read_at is not null or new.read_at is null then
   raise exception 'Only the recipient can mark an unread message read' using errcode='42501';
  end if;
  new.read_at:=now();
 end if;
 return new;
end $function$;
