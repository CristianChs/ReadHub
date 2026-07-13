-- ============================================================================
-- ReadHub — Validación de políticas RLS
-- ============================================================================
-- Requiere: migraciones aplicadas + supabase/seed.sql ya ejecutado.
--
-- Cómo ejecutar:
--   psql "<connection_string>" -f supabase/tests/rls_test.sql
--   (o pegar el contenido en el SQL Editor de Supabase Studio)
--
-- Debe ejecutarse con un rol capaz de hacer `SET ROLE anon / authenticated`
-- (el rol `postgres` que usa Supabase Studio / la connection string directa).
-- NO usar la anon key ni la conexión del cliente JS para correr este script.
--
-- Técnica: cada prueba simula un usuario cambiando el rol de Postgres
-- (anon / authenticated) y el claim `sub` del JWT (auth.uid()) vía
-- set_config('request.jwt.claims', ...). Las pruebas que insertan/actualizan/
-- eliminan usan SAVEPOINT + ROLLBACK TO SAVEPOINT para no dejar residuos en
-- los datos de la seed, sin importar si la prueba fue aceptada o rechazada.
-- Cada bloque imprime PASS o FAIL (vía RAISE NOTICE / RAISE EXCEPTION) con el
-- resultado esperado indicado explícitamente en el comentario y en el mensaje.
--
-- Este script asume los GRANTs por defecto de un proyecto Supabase (anon y
-- authenticated ya tienen privilegios de tabla a nivel de GRANT; RLS es la
-- capa que realmente decide qué filas son visibles/afectables).
--
-- Todo el script corre dentro de una única transacción que termina en
-- ROLLBACK: no modifica permanentemente los datos de la seed.
-- ============================================================================

-- Referencia de IDs (ver supabase/seed.sql):
--   admin   10000000-0000-0000-0000-000000000001
--   writer1 10000000-0000-0000-0000-000000000002
--   writer2 10000000-0000-0000-0000-000000000003
--   reader1 10000000-0000-0000-0000-000000000004
--   reader2 10000000-0000-0000-0000-000000000005
--   ART1 (público,  writer1)  20000000-0000-0000-0000-000000000001
--   ART2 (privado,  writer1)  20000000-0000-0000-0000-000000000002
--   ART3 (público,  writer2)  20000000-0000-0000-0000-000000000003
--   ART4 (público,  writer2)  20000000-0000-0000-0000-000000000004
--   ART5 (privado,  writer2)  20000000-0000-0000-0000-000000000005

begin;

-- ============================================================================
-- PROFILES — "Cada usuario únicamente puede ver y modificar su perfil."
-- ============================================================================

-- [1] SELECT / Autor del recurso — reader1 ve su propio perfil.
-- Esperado: 1 fila.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.profiles where id = '10000000-0000-0000-0000-000000000004';
  if v_count = 1 then
    raise notice 'PASS [1] profiles/SELECT/autor: % fila (esperado 1)', v_count;
  else
    raise exception 'FAIL [1] profiles/SELECT/autor: % filas (esperado 1)', v_count;
  end if;
end $$;

-- [2] SELECT / Usuario sin permisos — reader1 intenta ver el perfil de reader2.
-- Esperado: 0 filas (RLS filtra silenciosamente).
do $$
declare v_count int;
begin
  select count(*) into v_count from public.profiles where id = '10000000-0000-0000-0000-000000000005';
  if v_count = 0 then
    raise notice 'PASS [2] profiles/SELECT/sin_permisos: % filas (esperado 0)', v_count;
  else
    raise exception 'FAIL [2] profiles/SELECT/sin_permisos: % filas (esperado 0)', v_count;
  end if;
end $$;

-- [3] SELECT / Usuario no autenticado — anon consulta profiles.
-- Esperado: 0 filas (política restringida a `authenticated`).
select set_config('request.jwt.claims', '{}', true);
set local role anon;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.profiles;
  if v_count = 0 then
    raise notice 'PASS [3] profiles/SELECT/no_autenticado: % filas (esperado 0)', v_count;
  else
    raise exception 'FAIL [3] profiles/SELECT/no_autenticado: % filas (esperado 0)', v_count;
  end if;
end $$;

-- [4] UPDATE / Autor del recurso — reader1 actualiza su propio teléfono.
-- Esperado: 1 fila actualizada.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
savepoint sp4;
do $$
declare v_count int;
begin
  update public.profiles set phone = '+593999999999' where id = '10000000-0000-0000-0000-000000000004';
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [4] profiles/UPDATE/autor: % fila (esperado 1)', v_count;
  else
    raise exception 'FAIL [4] profiles/UPDATE/autor: % filas (esperado 1)', v_count;
  end if;
end $$;
rollback to savepoint sp4;

-- [5] UPDATE / Usuario sin permisos — reader1 intenta actualizar el perfil de reader2.
-- Esperado: 0 filas actualizadas (USING filtra la fila objetivo).
savepoint sp5;
do $$
declare v_count int;
begin
  update public.profiles set phone = '+593888888888' where id = '10000000-0000-0000-0000-000000000005';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice 'PASS [5] profiles/UPDATE/sin_permisos: % filas (esperado 0)', v_count;
  else
    raise exception 'FAIL [5] profiles/UPDATE/sin_permisos: % filas (esperado 0)', v_count;
  end if;
end $$;
rollback to savepoint sp5;

-- ============================================================================
-- ARTICLES
-- ============================================================================

-- [6] SELECT / Usuario no autenticado — anon solo ve artículos públicos.
-- Esperado: 3 filas (ART1, ART3, ART4).
select set_config('request.jwt.claims', '{}', true);
set local role anon;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.articles;
  if v_count = 3 then
    raise notice 'PASS [6] articles/SELECT/no_autenticado: % filas (esperado 3)', v_count;
  else
    raise exception 'FAIL [6] articles/SELECT/no_autenticado: % filas (esperado 3)', v_count;
  end if;
end $$;

-- [7] SELECT / Usuario autenticado sin artículos propios — reader1 solo ve públicos.
-- Esperado: 3 filas.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.articles;
  if v_count = 3 then
    raise notice 'PASS [7] articles/SELECT/autenticado_sin_propios: % filas (esperado 3)', v_count;
  else
    raise exception 'FAIL [7] articles/SELECT/autenticado_sin_propios: % filas (esperado 3)', v_count;
  end if;
end $$;

-- [8] SELECT / Autor del recurso — writer1 ve públicos + su propio borrador (ART2).
-- Esperado: 4 filas (ART1, ART2, ART3, ART4; NO ART5 que es borrador de writer2).
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.articles;
  if v_count = 4 then
    raise notice 'PASS [8] articles/SELECT/autor: % filas (esperado 4)', v_count;
  else
    raise exception 'FAIL [8] articles/SELECT/autor: % filas (esperado 4)', v_count;
  end if;
end $$;

-- [9] INSERT / Usuario autenticado, autor legítimo — writer1 crea su propio artículo.
-- Esperado: éxito (1 fila insertada).
savepoint sp9;
do $$
declare v_count int;
begin
  insert into public.articles (author_id, title, is_public)
  values ('10000000-0000-0000-0000-000000000002', 'Artículo de prueba RLS', false);
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [9] articles/INSERT/autor_legitimo: insertado correctamente';
  else
    raise exception 'FAIL [9] articles/INSERT/autor_legitimo: no se insertó la fila';
  end if;
end $$;
rollback to savepoint sp9;

-- [10] INSERT / Usuario sin permisos — reader1 intenta insertar suplantando a writer1.
-- Esperado: ERROR (viola WITH CHECK de RLS).
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
savepoint sp10;
do $$
begin
  insert into public.articles (author_id, title, is_public)
  values ('10000000-0000-0000-0000-000000000002', 'Suplantación no autorizada', true);

  raise exception 'FAIL [10] articles/INSERT/sin_permisos: el insert no debió permitirse';
exception
  when insufficient_privilege then
    raise notice 'PASS [10] articles/INSERT/sin_permisos: rechazado correctamente por RLS';
end $$;
rollback to savepoint sp10;

-- [11] UPDATE / Autor del recurso — writer1 edita su propio artículo (ART1).
-- Esperado: 1 fila actualizada.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;
savepoint sp11;
do $$
declare v_count int;
begin
  update public.articles set title = 'Introducción a PostgreSQL (editado)'
  where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [11] articles/UPDATE/autor: % fila (esperado 1)', v_count;
  else
    raise exception 'FAIL [11] articles/UPDATE/autor: % filas (esperado 1)', v_count;
  end if;
end $$;
rollback to savepoint sp11;

-- [12] UPDATE / Usuario sin permisos — reader1 intenta editar ART1 (de writer1).
-- Esperado: 0 filas actualizadas.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
savepoint sp12;
do $$
declare v_count int;
begin
  update public.articles set title = 'Intento no autorizado'
  where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice 'PASS [12] articles/UPDATE/sin_permisos: % filas (esperado 0)', v_count;
  else
    raise exception 'FAIL [12] articles/UPDATE/sin_permisos: % filas (esperado 0)', v_count;
  end if;
end $$;
rollback to savepoint sp12;

-- [13] DELETE / Autor del recurso — writer1 borra su propio borrador (ART2).
-- Esperado: 1 fila eliminada.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002"}', true);
set local role authenticated;
savepoint sp13;
do $$
declare v_count int;
begin
  delete from public.articles where id = '20000000-0000-0000-0000-000000000002';
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [13] articles/DELETE/autor: % fila (esperado 1)', v_count;
  else
    raise exception 'FAIL [13] articles/DELETE/autor: % filas (esperado 1)', v_count;
  end if;
end $$;
rollback to savepoint sp13;

-- [14] DELETE / Usuario sin permisos — reader1 intenta borrar ART1 (de writer1).
-- Esperado: 0 filas eliminadas.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
savepoint sp14;
do $$
declare v_count int;
begin
  delete from public.articles where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice 'PASS [14] articles/DELETE/sin_permisos: % filas (esperado 0)', v_count;
  else
    raise exception 'FAIL [14] articles/DELETE/sin_permisos: % filas (esperado 0)', v_count;
  end if;
end $$;
rollback to savepoint sp14;

-- ============================================================================
-- COMMENTS
-- ============================================================================

-- [15] SELECT / Usuario no autenticado — anon lee todos los comentarios.
-- Esperado: 5 filas.
select set_config('request.jwt.claims', '{}', true);
set local role anon;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.comments;
  if v_count = 5 then
    raise notice 'PASS [15] comments/SELECT/no_autenticado: % filas (esperado 5)', v_count;
  else
    raise exception 'FAIL [15] comments/SELECT/no_autenticado: % filas (esperado 5)', v_count;
  end if;
end $$;

-- [16] INSERT / Usuario autenticado — reader2 comenta ART3 como sí mismo.
-- Esperado: éxito.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005"}', true);
set local role authenticated;
savepoint sp16;
do $$
declare v_count int;
begin
  insert into public.comments (article_id, user_id, comment)
  values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', 'Comentario de prueba RLS.');
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [16] comments/INSERT/autenticado: insertado correctamente';
  else
    raise exception 'FAIL [16] comments/INSERT/autenticado: no se insertó la fila';
  end if;
end $$;
rollback to savepoint sp16;

-- [17] INSERT / Usuario sin permisos — reader2 intenta comentar suplantando a reader1.
-- Esperado: ERROR.
savepoint sp17;
do $$
begin
  insert into public.comments (article_id, user_id, comment)
  values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', 'Suplantación.');

  raise exception 'FAIL [17] comments/INSERT/sin_permisos: el insert no debió permitirse';
exception
  when insufficient_privilege then
    raise notice 'PASS [17] comments/INSERT/sin_permisos: rechazado correctamente por RLS';
end $$;
rollback to savepoint sp17;

-- [18] UPDATE / Autor del recurso — reader1 edita su propio comentario en ART1.
-- Esperado: 1 fila actualizada.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
savepoint sp18;
do $$
declare v_count int;
begin
  update public.comments set comment = 'Comentario editado por su autor.'
  where article_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000004';
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [18] comments/UPDATE/autor: % fila (esperado 1)', v_count;
  else
    raise exception 'FAIL [18] comments/UPDATE/autor: % filas (esperado 1)', v_count;
  end if;
end $$;
rollback to savepoint sp18;

-- [19] UPDATE / Usuario sin permisos — reader2 intenta editar el comentario de reader1.
-- Esperado: 0 filas actualizadas.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005"}', true);
set local role authenticated;
savepoint sp19;
do $$
declare v_count int;
begin
  update public.comments set comment = 'Intento no autorizado.'
  where article_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000004';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice 'PASS [19] comments/UPDATE/sin_permisos: % filas (esperado 0)', v_count;
  else
    raise exception 'FAIL [19] comments/UPDATE/sin_permisos: % filas (esperado 0)', v_count;
  end if;
end $$;
rollback to savepoint sp19;

-- [20] DELETE / Autor del recurso — reader1 borra su propio comentario en ART3.
-- Esperado: 1 fila eliminada.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
savepoint sp20;
do $$
declare v_count int;
begin
  delete from public.comments
  where article_id = '20000000-0000-0000-0000-000000000003'
    and user_id = '10000000-0000-0000-0000-000000000004';
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [20] comments/DELETE/autor: % fila (esperado 1)', v_count;
  else
    raise exception 'FAIL [20] comments/DELETE/autor: % filas (esperado 1)', v_count;
  end if;
end $$;
rollback to savepoint sp20;

-- [21] DELETE / Administrador — admin borra el comentario de writer2 en ART1.
-- Esperado: 1 fila eliminada (comments_delete_admin).
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
savepoint sp21;
do $$
declare v_count int;
begin
  delete from public.comments
  where article_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000003';
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [21] comments/DELETE/administrador: % fila (esperado 1)', v_count;
  else
    raise exception 'FAIL [21] comments/DELETE/administrador: % filas (esperado 1)', v_count;
  end if;
end $$;
rollback to savepoint sp21;

-- [22] DELETE / Usuario sin permisos — reader2 (ni autor ni admin) intenta borrar
-- el comentario de writer2 en ART1.
-- Esperado: 0 filas eliminadas.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005"}', true);
set local role authenticated;
savepoint sp22;
do $$
declare v_count int;
begin
  delete from public.comments
  where article_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000003';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice 'PASS [22] comments/DELETE/sin_permisos: % filas (esperado 0)', v_count;
  else
    raise exception 'FAIL [22] comments/DELETE/sin_permisos: % filas (esperado 0)', v_count;
  end if;
end $$;
rollback to savepoint sp22;

-- ============================================================================
-- LIKES
-- ============================================================================

-- [23] INSERT / Usuario autenticado — reader1 da like a ART3 (aún no lo tenía).
-- Esperado: éxito.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
savepoint sp23;
do $$
declare v_count int;
begin
  insert into public.likes (article_id, user_id)
  values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004');
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [23] likes/INSERT/autenticado: insertado correctamente';
  else
    raise exception 'FAIL [23] likes/INSERT/autenticado: no se insertó la fila';
  end if;
end $$;
rollback to savepoint sp23;

-- [24] INSERT / Usuario sin permisos — reader1 intenta dar like suplantando a reader2.
-- Esperado: ERROR.
savepoint sp24;
do $$
begin
  insert into public.likes (article_id, user_id)
  values ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005');

  raise exception 'FAIL [24] likes/INSERT/sin_permisos: el insert no debió permitirse';
exception
  when insufficient_privilege then
    raise notice 'PASS [24] likes/INSERT/sin_permisos: rechazado correctamente por RLS';
end $$;
rollback to savepoint sp24;

-- [25] DELETE / Propietario — reader1 quita su propio like de ART1.
-- Esperado: 1 fila eliminada.
savepoint sp25;
do $$
declare v_count int;
begin
  delete from public.likes
  where article_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000004';
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [25] likes/DELETE/propietario: % fila (esperado 1)', v_count;
  else
    raise exception 'FAIL [25] likes/DELETE/propietario: % filas (esperado 1)', v_count;
  end if;
end $$;
rollback to savepoint sp25;

-- [26] DELETE / Usuario sin permisos — reader1 intenta quitar el like de reader2 en ART3.
-- Esperado: 0 filas eliminadas.
savepoint sp26;
do $$
declare v_count int;
begin
  delete from public.likes
  where article_id = '20000000-0000-0000-0000-000000000003'
    and user_id = '10000000-0000-0000-0000-000000000005';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice 'PASS [26] likes/DELETE/sin_permisos: % filas (esperado 0)', v_count;
  else
    raise exception 'FAIL [26] likes/DELETE/sin_permisos: % filas (esperado 0)', v_count;
  end if;
end $$;
rollback to savepoint sp26;

-- [27] SELECT / Usuario autenticado — reader1 intenta leer la tabla likes.
-- Esperado: 0 filas. La especificación no define política de SELECT para
-- likes; con RLS activo y sin policy, la tabla es ilegible para cualquier rol
-- que no sea service_role. Esta prueba documenta ese comportamiento (no es un
-- bug del script).
do $$
declare v_count int;
begin
  select count(*) into v_count from public.likes;
  if v_count = 0 then
    raise notice 'PASS [27] likes/SELECT/sin_politica: % filas (esperado 0, gap conocido)', v_count;
  else
    raise exception 'FAIL [27] likes/SELECT/sin_politica: % filas (esperado 0)', v_count;
  end if;
end $$;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- [28] INSERT / Usuario autenticado — reader1 registra una visualización de ART3.
-- Esperado: éxito.
savepoint sp28;
do $$
declare v_count int;
begin
  insert into public.views (article_id, user_id)
  values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004');
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [28] views/INSERT/autenticado: insertado correctamente';
  else
    raise exception 'FAIL [28] views/INSERT/autenticado: no se insertó la fila';
  end if;
end $$;
rollback to savepoint sp28;

-- [29] SELECT / Autor del recurso — writer2 ve las visualizaciones de sus artículos
-- (ART3 + ART4), no las de ART1 (de writer1).
-- Esperado: 4 filas.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003"}', true);
set local role authenticated;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.views;
  if v_count = 4 then
    raise notice 'PASS [29] views/SELECT/autor: % filas (esperado 4)', v_count;
  else
    raise exception 'FAIL [29] views/SELECT/autor: % filas (esperado 4)', v_count;
  end if;
end $$;

-- [30] SELECT / Administrador — admin ve todas las visualizaciones.
-- Esperado: 8 filas.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001"}', true);
set local role authenticated;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.views;
  if v_count = 8 then
    raise notice 'PASS [30] views/SELECT/administrador: % filas (esperado 8)', v_count;
  else
    raise exception 'FAIL [30] views/SELECT/administrador: % filas (esperado 8)', v_count;
  end if;
end $$;

-- [31] SELECT / Usuario sin permisos — reader1 (generó varias vistas, pero no es
-- autor de ningún artículo ni admin) intenta leer views.
-- Esperado: 0 filas (la especificación solo autoriza admin o autor, no el
-- propio usuario que generó la visualización).
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.views;
  if v_count = 0 then
    raise notice 'PASS [31] views/SELECT/sin_permisos: % filas (esperado 0)', v_count;
  else
    raise exception 'FAIL [31] views/SELECT/sin_permisos: % filas (esperado 0)', v_count;
  end if;
end $$;

-- ============================================================================
-- FAVORITES
-- ============================================================================

-- [32] SELECT / Propietario — reader1 ve sus propios favoritos (ART1, ART3).
-- Esperado: 2 filas.
do $$
declare v_count int;
begin
  select count(*) into v_count from public.favorites;
  if v_count = 2 then
    raise notice 'PASS [32] favorites/SELECT/propietario: % filas (esperado 2)', v_count;
  else
    raise exception 'FAIL [32] favorites/SELECT/propietario: % filas (esperado 2)', v_count;
  end if;
end $$;

-- [33] SELECT / Usuario sin permisos — reader1 intenta ver los favoritos de reader2.
-- Esperado: 0 filas (RLS ya limita a los propios; esta consulta filtra explícito
-- por reader2 y debe seguir devolviendo 0).
do $$
declare v_count int;
begin
  select count(*) into v_count from public.favorites where user_id = '10000000-0000-0000-0000-000000000005';
  if v_count = 0 then
    raise notice 'PASS [33] favorites/SELECT/sin_permisos: % filas (esperado 0)', v_count;
  else
    raise exception 'FAIL [33] favorites/SELECT/sin_permisos: % filas (esperado 0)', v_count;
  end if;
end $$;

-- [34] INSERT / Usuario autenticado — reader2 marca ART1 como favorito.
-- Esperado: éxito.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005"}', true);
set local role authenticated;
savepoint sp34;
do $$
declare v_count int;
begin
  insert into public.favorites (article_id, user_id)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005');
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [34] favorites/INSERT/autenticado: insertado correctamente';
  else
    raise exception 'FAIL [34] favorites/INSERT/autenticado: no se insertó la fila';
  end if;
end $$;
rollback to savepoint sp34;

-- [35] INSERT / Usuario sin permisos — reader1 intenta marcar favorito suplantando
-- a reader2.
-- Esperado: ERROR.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004"}', true);
set local role authenticated;
savepoint sp35;
do $$
begin
  insert into public.favorites (article_id, user_id)
  values ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005');

  raise exception 'FAIL [35] favorites/INSERT/sin_permisos: el insert no debió permitirse';
exception
  when insufficient_privilege then
    raise notice 'PASS [35] favorites/INSERT/sin_permisos: rechazado correctamente por RLS';
end $$;
rollback to savepoint sp35;

-- [36] DELETE / Propietario — reader1 quita su propio favorito de ART1.
-- Esperado: 1 fila eliminada.
savepoint sp36;
do $$
declare v_count int;
begin
  delete from public.favorites
  where article_id = '20000000-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000004';
  get diagnostics v_count = row_count;
  if v_count = 1 then
    raise notice 'PASS [36] favorites/DELETE/propietario: % fila (esperado 1)', v_count;
  else
    raise exception 'FAIL [36] favorites/DELETE/propietario: % filas (esperado 1)', v_count;
  end if;
end $$;
rollback to savepoint sp36;

-- [37] DELETE / Usuario sin permisos — reader1 intenta quitar el favorito de
-- reader2 en ART4.
-- Esperado: 0 filas eliminadas.
savepoint sp37;
do $$
declare v_count int;
begin
  delete from public.favorites
  where article_id = '20000000-0000-0000-0000-000000000004'
    and user_id = '10000000-0000-0000-0000-000000000005';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice 'PASS [37] favorites/DELETE/sin_permisos: % filas (esperado 0)', v_count;
  else
    raise exception 'FAIL [37] favorites/DELETE/sin_permisos: % filas (esperado 0)', v_count;
  end if;
end $$;
rollback to savepoint sp37;

reset role;
do $$ begin raise notice '=== Validación RLS completa: 37/37 pruebas ejecutadas ==='; end $$;

-- No se persiste ningún cambio: este script es de solo validación.
rollback;
