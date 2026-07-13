-- ============================================================================
-- categories: catálogo de categorías temáticas de ReadHub.
--
-- ReadHub no clasificaba los artículos. Se introduce un catálogo canónico
-- (tabla `categories`) y una relación opcional desde `articles` hacia él.
--
-- Diseño:
--   - La categoría es OPCIONAL (articles.category_id nullable): los artículos
--     existentes siguen siendo válidos sin tocar nada, y publicar sin categoría
--     sigue permitido. No se rompe ningún flujo actual.
--   - `on delete set null`: borrar una categoría del catálogo no borra artículos.
--   - El catálogo es de lectura pública (anon incluido): es información no
--     sensible y los clientes MCP deben poder navegarlo. Su escritura queda sin
--     política, o sea reservada a la service_role / dashboard: no es contenido
--     que genere el usuario.
-- ============================================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) > 0),
  name text not null check (char_length(name) > 0),
  description text,
  created_at timestamptz not null default now()
);

comment on table public.categories is 'Catálogo canónico de categorías temáticas. Escritura reservada a la service_role.';

alter table public.categories enable row level security;

-- Lectura pública del catálogo (anon y authenticated).
create policy categories_select_all
  on public.categories for select
  using (true);

-- Sin políticas de INSERT/UPDATE/DELETE: el catálogo se gestiona fuera de RLS.
grant select on public.categories to anon, authenticated;

-- Relación opcional artículo -> categoría.
alter table public.articles
  add column category_id uuid references public.categories (id) on delete set null;

create index idx_articles_category_id on public.articles (category_id);

-- Catálogo inicial. Slugs estables (clave de negocio); el nombre es editable.
insert into public.categories (slug, name, description) values
  ('technology',            'Tecnología',              'Tendencias, herramientas y novedades del mundo tecnológico.'),
  ('software-development',  'Desarrollo de Software',  'Programación, arquitectura, buenas prácticas y metodologías.'),
  ('design',               'Diseño',                  'Diseño de producto, UX/UI y experiencia de usuario.'),
  ('product-management',   'Gestión de Producto',     'Estrategia de producto, roadmap y descubrimiento.'),
  ('business',             'Negocios',                'Emprendimiento, startups y estrategia empresarial.'),
  ('data-science',         'Ciencia de Datos',        'Análisis de datos, machine learning e inteligencia artificial.'),
  ('career',               'Carrera Profesional',     'Desarrollo profesional, habilidades y crecimiento laboral.'),
  ('science',              'Ciencia',                 'Divulgación científica e investigación.');
