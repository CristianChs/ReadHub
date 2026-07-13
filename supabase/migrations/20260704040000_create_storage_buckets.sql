-- ============================================================================
-- Buckets de Storage para la publicación de artículos.
--   images    -> portadas (lectura pública para mostrarlas en el listado/detalle)
--   documents -> documento del artículo (lectura pública; el artículo es público)
--
-- Convención de rutas (ver storage.service): <userId>/<timestamp>-<archivo>.
-- Las políticas de subida exigen que el primer segmento de la ruta sea el uid
-- del usuario autenticado, de modo que cada quien solo escribe en su carpeta.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('images', 'images', true, 5242880),      -- 5 MB
  ('documents', 'documents', true, 10485760) -- 10 MB
on conflict (id) do nothing;

-- --- Lectura pública (buckets públicos) --------------------------------------
create policy "images_select_public"
  on storage.objects for select
  using (bucket_id = 'images');

create policy "documents_select_public"
  on storage.objects for select
  using (bucket_id = 'documents');

-- --- Subida: solo autenticado y únicamente en su propia carpeta --------------
create policy "images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --- Borrado: solo el propietario de la carpeta ------------------------------
create policy "images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
