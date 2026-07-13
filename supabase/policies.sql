-- ============================================================================
-- ReadHub — Políticas RLS (referencia consolidada)
-- ============================================================================
-- Referencia legible. La fuente ejecutable es la migración:
--   supabase/migrations/20260701120700_create_policies.sql
--
-- RLS se habilita (ENABLE ROW LEVEL SECURITY) en las migraciones de creación
-- de cada tabla; aquí solo se listan las políticas.
-- ============================================================================

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---- profiles ----------------------------------------------------------
-- Cada usuario únicamente puede ver y modificar su perfil.
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---- articles ------------------------------------------------------------
-- SELECT: todos pueden leer artículos públicos.
create policy articles_select_public
  on public.articles for select
  using (is_public = true);

-- Adición: el autor también puede ver sus propios borradores no públicos.
create policy articles_select_own
  on public.articles for select
  to authenticated
  using (auth.uid() = author_id);

-- INSERT: solo usuarios autenticados, como propio autor.
create policy articles_insert_authenticated
  on public.articles for insert
  to authenticated
  with check (auth.uid() = author_id);

-- UPDATE: solo el autor.
create policy articles_update_own
  on public.articles for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- DELETE: solo el autor.
create policy articles_delete_own
  on public.articles for delete
  to authenticated
  using (auth.uid() = author_id);

-- ---- comments --------------------------------------------------------
-- Leer todos.
create policy comments_select_all
  on public.comments for select
  using (true);

-- Crear autenticado.
create policy comments_insert_authenticated
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Editar solo autor.
create policy comments_update_own
  on public.comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Eliminar autor o admin.
create policy comments_delete_own
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id);

create policy comments_delete_admin
  on public.comments for delete
  to authenticated
  using (public.is_admin());

-- ---- likes -------------------------------------------------------------
-- Insert: solo autenticado, como propio usuario.
create policy likes_insert_authenticated
  on public.likes for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Delete: solo propietario.
create policy likes_delete_own
  on public.likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- Sin política de SELECT (no especificada): nadie puede leer likes sin
-- service_role key hasta que se defina explícitamente.

-- ---- views ---------------------------------------------------------------
-- INSERT: usuarios autenticados, como propio usuario.
create policy views_insert_authenticated
  on public.views for insert
  to authenticated
  with check (auth.uid() = user_id);

-- SELECT: solo administradores o el autor del artículo.
create policy views_select_admin
  on public.views for select
  to authenticated
  using (public.is_admin());

create policy views_select_article_author
  on public.views for select
  to authenticated
  using (
    exists (
      select 1 from public.articles a
      where a.id = views.article_id
        and a.author_id = auth.uid()
    )
  );

-- ---- favorites -------------------------------------------------------
-- Todo restringido al propietario.
create policy favorites_select_own
  on public.favorites for select
  to authenticated
  using (auth.uid() = user_id);

create policy favorites_insert_own
  on public.favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy favorites_delete_own
  on public.favorites for delete
  to authenticated
  using (auth.uid() = user_id);
