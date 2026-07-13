-- ============================================================================
-- Storage: buckets para documentos e imágenes de portada de los artículos.
-- Buckets públicos (lectura vía URL pública). La escritura queda restringida
-- al propietario autenticado dentro de su carpeta (<uid>/...).
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', true),
  ('images', 'images', true)
on conflict (id) do nothing;

-- Lectura: cualquiera puede leer objetos de estos buckets (son públicos).
create policy "readhub_storage_read"
  on storage.objects for select
  using (bucket_id in ('documents', 'images'));

-- Subida: solo usuarios autenticados y únicamente en su propia carpeta
-- (el primer segmento de la ruta debe ser su uid). Coincide con
-- storage.service.buildObjectPath: `<userId>/<timestamp>-<nombre>`.
create policy "readhub_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('documents', 'images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Actualización / borrado: solo el propietario de sus propios objetos.
create policy "readhub_storage_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('documents', 'images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "readhub_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('documents', 'images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
