-- articles: cada artículo pertenece a un único usuario (profiles).
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) > 0),
  summary text,
  document_path text,
  image_path text,
  created_at timestamptz not null default now(),
  is_public boolean not null default false
);

comment on table public.articles is 'Artículos publicados por los usuarios.';
comment on column public.articles.is_public is 'Controla la visibilidad pública del artículo.';

create index idx_articles_author_id on public.articles (author_id);

alter table public.articles enable row level security;
