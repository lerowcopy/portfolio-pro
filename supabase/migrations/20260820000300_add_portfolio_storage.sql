begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('portfolio-avatars', 'portfolio-avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('portfolio-logos', 'portfolio-logos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('portfolio-project-images', 'portfolio-project-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Portfolio Pro owners manage private media" on storage.objects;

create policy "Portfolio Pro owners manage private media"
on storage.objects
for all
to authenticated
using (
  bucket_id in ('portfolio-avatars', 'portfolio-logos', 'portfolio-project-images')
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id in ('portfolio-avatars', 'portfolio-logos', 'portfolio-project-images')
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

commit;
