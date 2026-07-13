-- likes: un usuario solo puede registrar un like por artículo.
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (article_id, user_id)
);

comment on table public.likes is '"Me gusta" de un usuario sobre un artículo.';

create index idx_likes_article_id on public.likes (article_id);

alter table public.likes enable row level security;
