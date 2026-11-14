-- A post needs text or a photo. Captions remain normalized and limited to 280 code points.
alter table public.posts
  drop constraint posts_content_length,
  drop constraint posts_content_normalized,
  add constraint posts_content_length check (char_length(content) between 0 and 280),
  add constraint posts_content_normalized check (
    content = public.trim_wall_message(content)
    and (char_length(content) > 0 or image_path is not null)
  );
