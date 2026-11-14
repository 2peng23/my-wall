-- Keep legacy messages intact; only new visitor writes require a browser UUID.
alter table public.posts add column visitor_id uuid;
alter table public.posts drop constraint posts_author_name_check;
alter table public.posts alter column author_name drop not null;
alter table public.posts alter column author_name drop default;
alter table public.posts add constraint posts_author_name_valid check (
  author_name is null or (
    char_length(author_name) between 1 and 48
    and author_name = public.trim_wall_message(author_name)
    and author_name !~ '[[:cntrl:]]'
  )
);

grant insert (visitor_id, author_name) on public.posts to anon;
drop policy "Visitors can share messages" on public.posts;
create policy "Visitors can share messages" on public.posts for insert to anon
  with check (visitor_id is not null);

comment on column public.posts.visitor_id is 'Browser-stored random UUID. A convenience identifier, not verified identity.';
comment on column public.posts.author_name is 'Optional self-supplied display name. NULL displays the visitor UUID label.';
