-- Match a literal dot without relying on SQL regex backslash escaping.
drop policy if exists tradarr_avatar_owner_insert on storage.objects;
create policy tradarr_avatar_owner_insert on storage.objects
 for insert to authenticated with check (
   bucket_id='tradarr-avatars'
   and (storage.foldername(name))[1]=(select auth.uid())::text
   and split_part(name,'/',2) ~ '^[a-zA-Z0-9_-]{8,60}[.](jpg|png|webp)$'
   and split_part(name,'/',3)=''
   and exists (
     select 1 from public.tradesperson_profiles t where t.user_id=(select auth.uid())
   )
 );
