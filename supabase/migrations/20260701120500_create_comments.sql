-- comments: comentarios de usuarios sobre artículos.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  comment text not null check (char_length(comment) > 0),
  created_at timestamptz not null default now()
);

comment on table public.comments is 'Comentarios realizados sobre un artículo.';

create index idx_comments_article_id on public.comments (article_id);

alter table public.comments enable row level security;
