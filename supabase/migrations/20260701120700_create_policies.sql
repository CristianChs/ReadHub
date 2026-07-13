-- ============================================================================
-- Políticas RLS
-- ============================================================================
-- RLS ya fue habilitado (ENABLE ROW LEVEL SECURITY) en las migraciones de
-- creación de cada tabla. Aquí solo se definen las políticas.
--
-- Cuando una tabla tiene varias políticas permisivas para la misma operación
-- (p.ej. "autor o admin"), Postgres las combina con OR. Por eso algunas reglas
-- se expresan como dos políticas separadas en vez de una condición con OR
-- dentro del mismo USING, para que cada política se corresponda 1:1 con una
-- regla de la especificación.
-- ============================================================================

-- Helper: evita repetir la subconsulta a profiles en cada política y evita
-- problemas de recursión de RLS (SECURITY DEFINER omite RLS internamente).
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

-- ----------------------------------------------------------------------------
-- profiles: cada usuario únicamente puede ver y modificar su perfil.
-- ----------------------------------------------------------------------------
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Sin política de INSERT: los perfiles se crean únicamente vía el trigger
-- on_auth_user_created (SECURITY DEFINER), no por inserts directos del cliente.

-- ----------------------------------------------------------------------------
-- articles
-- ----------------------------------------------------------------------------
-- SELECT: todos pueden leer artículos públicos.
create policy articles_select_public
  on public.articles for select
  using (is_public = true);

-- Adición no explícita en la especificación: el autor también puede ver sus
-- propios artículos no públicos (borradores). Sin esto, el autor no podría
-- gestionar contenido antes de publicarlo. Quitar si no se desea.
create policy articles_select_own
  on public.articles for select
  to authenticated
  using (auth.uid() = author_id);

-- INSERT: solo usuarios autenticados, y únicamente como propio autor.
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

-- ----------------------------------------------------------------------------
-- comments
-- ----------------------------------------------------------------------------
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

-- Eliminar autor o admin (dos políticas permisivas combinadas con OR).
create policy comments_delete_own
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id);

create policy comments_delete_admin
  on public.comments for delete
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- likes
-- ----------------------------------------------------------------------------
-- Insert: solo autenticado, y únicamente como propio usuario.
create policy likes_insert_authenticated
  on public.likes for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Delete: solo propietario.
create policy likes_delete_own
  on public.likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- Nota: la especificación no define una política de SELECT para likes.
-- Se respeta tal cual: con RLS activo y sin política de SELECT, nadie puede
-- leer la tabla (ni siquiera para contar likes) salvo con la service_role key.
-- Confirmar si se desea agregar SELECT público antes de construir esa
-- funcionalidad en el frontend.

-- ----------------------------------------------------------------------------
-- views
-- ----------------------------------------------------------------------------
-- INSERT: usuarios autenticados, únicamente como propio usuario.
create policy views_insert_authenticated
  on public.views for insert
  to authenticated
  with check (auth.uid() = user_id);

-- SELECT: solo administradores o el autor del artículo (no el usuario que vio).
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

-- ----------------------------------------------------------------------------
-- favorites: todo restringido al propietario.
-- ----------------------------------------------------------------------------
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
