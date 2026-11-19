-- Public profile photos are opt-in; unlike private chat attachments,
-- clients need to render these without authenticated storage requests.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tradarr-avatars','tradarr-avatars',true,2097152,
 array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set
 public=true,file_size_limit=2097152,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists tradarr_avatar_owner_insert on storage.objects;
create policy tradarr_avatar_owner_insert on storage.objects
 for insert to authenticated with check (
   bucket_id='tradarr-avatars'
   and (storage.foldername(name))[1]=(select auth.uid())::text
   and split_part(name,'/',2) ~ '^[a-zA-Z0-9_-]{8,60}\\.(jpg|png|webp)$'
   and split_part(name,'/',3)=''
   and exists (
     select 1 from public.tradesperson_profiles t where t.user_id=(select auth.uid())
   )
 );
-- No overwrite or delete permissions: uploading cannot modify another profile's
-- shared image. Public READ is provided by the bucket's public URL.
