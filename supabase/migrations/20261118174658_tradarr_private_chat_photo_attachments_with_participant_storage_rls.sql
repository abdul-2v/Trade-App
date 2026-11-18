
alter table public.messages
 add column if not exists attachment_path text,
 add column if not exists attachment_mime text;
do $$
begin
 if not exists(select 1 from pg_constraint where conname='tradarr_attachment_type_check') then
  alter table public.messages add constraint tradarr_attachment_type_check
  check (
    (attachment_path is null and attachment_mime is null)
    or (
      attachment_path is not null and attachment_mime in ('image/jpeg','image/png','image/webp')
      and length(attachment_path) between 78 and 260
    )
  );
 end if;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('tradarr-chat','tradarr-chat',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update
set public=false,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- Storage object keys: <conversation UUID>/<sender UUID>/<opaque photo filename>.
-- Only the two participants may view, and only the sender can upload into their own folder.
drop policy if exists tradarr_chat_photos_read on storage.objects;
create policy tradarr_chat_photos_read on storage.objects for select to authenticated
using(
 bucket_id='tradarr-chat'
 and exists (
  select 1 from public.conversations c
  where c.id::text=split_part(name,'/',1)
    and ((select auth.uid())=c.customer_id or (select auth.uid())=c.tradesperson_id)
 )
);
drop policy if exists tradarr_chat_photos_upload on storage.objects;
create policy tradarr_chat_photos_upload on storage.objects for insert to authenticated
with check (
 bucket_id='tradarr-chat'
 and split_part(name,'/',2)=(select auth.uid())::text
 and split_part(name,'/',3)<>'' and split_part(name,'/',4)=''
 and exists(
   select 1 from public.conversations c
   where c.id::text=split_part(name,'/',1)
     and ((select auth.uid())=c.customer_id or (select auth.uid())=c.tradesperson_id)
 )
);

CREATE OR REPLACE FUNCTION trade_private.tradarr_message_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if tg_op='INSERT' then
   if new.sender_id is distinct from auth.uid() or new.read_at is not null then
    raise exception 'Only the sender may create a new unread message' using errcode='42501';
   end if;
   if new.attachment_path is not null then
     if new.attachment_path not like new.conversation_id::text||'/'||new.sender_id::text||'/%'
       or new.attachment_mime not in ('image/jpeg','image/png','image/webp')
       or not exists(
          select 1 from storage.objects o where o.bucket_id='tradarr-chat'
          and o.name=new.attachment_path
       ) then
       raise exception 'Photo attachment is not associated with your conversation'
         using errcode='42501';
     end if;
   end if;
 elsif tg_op='UPDATE' then
   if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at
    or new.client_token is distinct from old.client_token
    or new.attachment_path is distinct from old.attachment_path
    or new.attachment_mime is distinct from old.attachment_mime
   then
    raise exception 'Sent messages cannot be edited' using errcode='42501';
   end if;
   if old.sender_id=auth.uid() or old.read_at is not null or new.read_at is null then
    raise exception 'Only the recipient can mark an unread message read' using errcode='42501';
   end if;
   new.read_at := now();
 end if;
 return new;
end $function$;


