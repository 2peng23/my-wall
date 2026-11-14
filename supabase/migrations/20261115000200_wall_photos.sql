insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wall-photos', 'wall-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

create policy "Visitors can attach a new wall photo" on storage.objects
for insert to anon with check (
  bucket_id = 'wall-photos'
  and name ~ '^posts/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif)$'
);

-- Public bucket reads need no SELECT policy. Anonymous listing, overwriting,
-- updating, and deleting are intentionally not granted by this application.
