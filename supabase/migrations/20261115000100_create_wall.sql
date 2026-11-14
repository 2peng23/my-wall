-- A public, anonymous wall. Author and timestamp are database-owned fields.
create function public.trim_wall_message(value text)
returns text language sql immutable strict
set search_path = ''
as $$
  select btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_name text not null default 'Visitor' check (author_name = 'Visitor'),
  content text not null,
  created_at timestamptz not null default now(),
  image_path text,
  constraint posts_content_length check (char_length(content) between 1 and 280),
  constraint posts_content_normalized check (content = public.trim_wall_message(content) and char_length(public.trim_wall_message(content)) > 0),
  constraint posts_image_path check (image_path is null or image_path ~ '^posts/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif)$')
);

create index posts_chronological on public.posts (created_at desc, id desc);
alter table public.posts enable row level security;

revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon;
grant insert (id, content, image_path) on public.posts to anon;

create policy "Anyone can read the wall" on public.posts for select to anon using (true);
create policy "Visitors can share messages" on public.posts for insert to anon
  with check (author_name = 'Visitor');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;
