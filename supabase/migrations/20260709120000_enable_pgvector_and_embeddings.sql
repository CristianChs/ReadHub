-- ============================================================================
-- Infraestructura vectorial (pgvector) para el sistema RAG.
--
-- Esta migración es puramente ADITIVA: no altera ninguna tabla, política,
-- vista ni función existente. Prepara únicamente el almacenamiento y la
-- consulta por similitud. No inserta embeddings ni introduce lógica de negocio.
--
-- Decisiones (ver informe técnico):
--   * Modelo: tabla separada 1:N (artículo -> fragmentos/chunks), no una
--     columna en `articles`. Permite granularidad de cita, documentos largos
--     y evolución (nuevas fuentes de conocimiento) sin cambios estructurales.
--   * Dimensión: 1024 (Voyage AI `voyage-4`, dimensión por defecto).
--   * Distancia: coseno (`vector_cosine_ops`). Los vectores de Voyage vienen
--     normalizados, por lo que coseno y producto punto son equivalentes.
--   * Índice: HNSW (no IVFFlat). Ver justificación en el informe.
-- ============================================================================

-- --- 1. Extensión ------------------------------------------------------------
-- Se instala en el esquema `extensions`, igual que pgcrypto (convención del
-- proyecto). Por eso el tipo y los operadores se cualifican como `extensions.*`.
create extension if not exists "vector" with schema extensions;

-- --- 2. Almacenamiento -------------------------------------------------------
-- Un artículo se divide en N fragmentos; cada fragmento tiene su propio vector.
create table public.article_embeddings (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(content) > 0),
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now(),

  -- Idempotencia: reindexar un artículo no puede duplicar fragmentos.
  -- (Requisito de validación: "No existen embeddings duplicados").
  unique (article_id, chunk_index)
);

comment on table public.article_embeddings is
  'Fragmentos vectorizados de los artículos. Base de conocimiento del sistema RAG.';
comment on column public.article_embeddings.chunk_index is
  'Posición del fragmento dentro del artículo (0-based). Único junto a article_id.';
comment on column public.article_embeddings.content is
  'Texto original del fragmento. Se devuelve como contexto y como fuente citable.';
comment on column public.article_embeddings.embedding is
  'Vector de 1024 dimensiones (voyage-4). Normalizado: coseno == producto punto.';

-- Los vectores huérfanos se eliminan solos: ON DELETE CASCADE desde articles.
-- Este índice acelera ese borrado en cascada y el reindexado por artículo.
create index idx_article_embeddings_article_id
  on public.article_embeddings (article_id);

-- --- 3. Índice vectorial -----------------------------------------------------
-- HNSW con operator class de coseno. Se construye de forma incremental (no
-- requiere datos previos ni reentrenamiento), por lo que es válido desde la
-- tabla vacía. Parámetros por defecto (m=16, ef_construction=64), adecuados
-- para el volumen esperado de ReadHub.
create index idx_article_embeddings_embedding_hnsw
  on public.article_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

-- --- 4. Seguridad (RLS) ------------------------------------------------------
-- Modelo: los usuarios NUNCA leen esta tabla directamente. La recuperación se
-- hace exclusivamente por la función `match_article_chunks` (SECURITY DEFINER),
-- que filtra por `is_public`. Así un borrador ajeno nunca puede recuperarse.
alter table public.article_embeddings enable row level security;

-- Escritura: solo el autor del artículo puede indexar/reindexar su contenido.
-- (No se usa service_role: la indexación correrá con la sesión del usuario.)
create policy article_embeddings_insert_own
  on public.article_embeddings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.articles a
      where a.id = article_embeddings.article_id
        and a.author_id = auth.uid()
    )
  );

create policy article_embeddings_delete_own
  on public.article_embeddings for delete
  to authenticated
  using (
    exists (
      select 1 from public.articles a
      where a.id = article_embeddings.article_id
        and a.author_id = auth.uid()
    )
  );

-- Lectura directa: solo el autor, sobre sus propios artículos (diagnóstico).
-- La recuperación semántica NO pasa por aquí, sino por la función de abajo.
create policy article_embeddings_select_own
  on public.article_embeddings for select
  to authenticated
  using (
    exists (
      select 1 from public.articles a
      where a.id = article_embeddings.article_id
        and a.author_id = auth.uid()
    )
  );

-- --- 5. Función SQL reutilizable de búsqueda por similitud -------------------
-- Recibe el embedding de la consulta, calcula similitud coseno, devuelve los
-- fragmentos más relevantes ordenados de mayor a menor similitud.
--
-- SECURITY DEFINER a propósito: debe leer article_embeddings saltando la RLS
-- de fila, pero acota el resultado a artículos públicos (`a.is_public = true`).
-- Es la única puerta de lectura del índice para la aplicación.
--
-- El ORDER BY usa el operador de distancia `<=>` (no la similitud calculada)
-- para que el planificador pueda aprovechar el índice HNSW.
create or replace function public.match_article_chunks(
  query_embedding extensions.vector(1024),
  match_threshold double precision default 0.5,
  match_count integer default 5
)
returns table (
  article_id uuid,
  article_title text,
  chunk_index integer,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    e.article_id,
    a.title as article_title,
    e.chunk_index,
    e.content,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.article_embeddings e
  join public.articles a on a.id = e.article_id
  where a.is_public = true
    and 1 - (e.embedding <=> query_embedding) >= match_threshold
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

comment on function public.match_article_chunks is
  'Búsqueda semántica por similitud coseno sobre article_embeddings. Solo devuelve fragmentos de artículos públicos. Reutilizable por vector-search.service.';

-- La aplicación vive tras autenticación: no se expone a anon.
revoke all on function public.match_article_chunks(extensions.vector(1024), double precision, integer) from public, anon;
grant execute on function public.match_article_chunks(extensions.vector(1024), double precision, integer) to authenticated;
