-- ============================================================================
-- ReadHub — Esquema de base de datos (referencia consolidada)
-- ============================================================================
-- Este archivo es una referencia legible del esquema completo. La fuente de
-- verdad ejecutable son las migraciones en supabase/migrations/, que deben
-- aplicarse en orden para recrear la base de datos desde cero:
--
--   20260701120000_enable_extensions.sql
--   20260701120100_create_profiles.sql
--   20260701120200_create_articles.sql
--   20260701120300_create_views.sql
--   20260701120400_create_likes.sql
--   20260701120500_create_comments.sql
--   20260701120600_create_favorites.sql
--
-- Las políticas RLS se definen por separado en supabase/policies.sql
-- (cuarto prompt).
-- ============================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- ----------------------------------------------------------------------------
-- profiles — 1:1 con auth.users
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  birth_date date,
  phone text,
  role text not null default 'reader' check (role in ('reader', 'writer', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público de cada usuario autenticado en la plataforma.';
comment on column public.profiles.role is 'reader, writer o admin.';

alter table public.profiles enable row level security;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- articles — 1 usuario : N artículos
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- views — 1 artículo : N visualizaciones (evento, no contador)
-- ----------------------------------------------------------------------------
create table public.views (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

comment on table public.views is 'Registro de cada visualización de un artículo, un evento por fila.';

create index idx_views_article_id on public.views (article_id);

alter table public.views enable row level security;

-- ----------------------------------------------------------------------------
-- likes — 1 artículo : N likes, único por (article_id, user_id)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- comments — 1 artículo : N comentarios
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- favorites — 1 artículo : N favoritos, único por (article_id, user_id)
-- ----------------------------------------------------------------------------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (article_id, user_id)
);

comment on table public.favorites is 'Artículos guardados por un usuario.';

create index idx_favorites_article_id on public.favorites (article_id);

alter table public.favorites enable row level security;
