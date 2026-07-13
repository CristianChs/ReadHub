-- favorites: artículos guardados por un usuario. Estructura preparada desde el
-- inicio aunque la funcionalidad se implemente en fases posteriores.
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Evita duplicados: un usuario guarda un artículo una sola vez (mismo criterio que likes).
  unique (article_id, user_id)
);

comment on table public.favorites is 'Artículos guardados por un usuario.';

create index idx_favorites_article_id on public.favorites (article_id);

alter table public.favorites enable row level security;
