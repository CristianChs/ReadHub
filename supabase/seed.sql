-- ============================================================================
-- ReadHub — seed.sql
-- ============================================================================
-- SOLO PARA DESARROLLO LOCAL. Este script inserta usuarios directamente en
-- auth.users con contraseñas conocidas para poder probar RLS y flujos de
-- autenticación sin pasar por el signup real. Nunca ejecutar contra un
-- proyecto de producción.
--
-- Requiere que las migraciones ya se hayan aplicado (tablas + trigger
-- on_auth_user_created + políticas RLS).
--
-- Credenciales de prueba (misma contraseña para todos): ReadHub123!
--
--   admin@readhub.test    -> role: admin
--   writer1@readhub.test  -> role: writer
--   writer2@readhub.test  -> role: writer
--   reader1@readhub.test  -> role: reader
--   reader2@readhub.test  -> role: reader
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Usuarios de prueba (auth.users + auth.identities)
-- ----------------------------------------------------------------------------
-- Insertar en auth.users dispara el trigger on_auth_user_created, que crea
-- automáticamente la fila correspondiente en public.profiles (con role
-- 'reader' por defecto). El rol real de cada usuario se ajusta en el paso 2.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'admin@readhub.test',
   crypt('ReadHub123!', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'writer1@readhub.test',
   crypt('ReadHub123!', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'writer2@readhub.test',
   crypt('ReadHub123!', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'reader1@readhub.test',
   crypt('ReadHub123!', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005',
   'authenticated', 'authenticated', 'reader2@readhub.test',
   crypt('ReadHub123!', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}');

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '{"sub":"10000000-0000-0000-0000-000000000001","email":"admin@readhub.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
   '{"sub":"10000000-0000-0000-0000-000000000002","email":"writer1@readhub.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
   '{"sub":"10000000-0000-0000-0000-000000000003","email":"writer2@readhub.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004',
   '{"sub":"10000000-0000-0000-0000-000000000004","email":"reader1@readhub.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005',
   '{"sub":"10000000-0000-0000-0000-000000000005","email":"reader2@readhub.test"}', 'email', now(), now(), now());

-- ----------------------------------------------------------------------------
-- 2. Completar profiles (el trigger solo asigna id + defaults)
-- ----------------------------------------------------------------------------
update public.profiles set role = 'admin', birth_date = '1985-04-12', phone = '+593990000001'
  where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set role = 'writer', birth_date = '1990-06-23', phone = '+593990000002'
  where id = '10000000-0000-0000-0000-000000000002';
update public.profiles set role = 'writer', birth_date = '1992-11-02', phone = '+593990000003'
  where id = '10000000-0000-0000-0000-000000000003';
update public.profiles set role = 'reader', birth_date = '1998-01-15', phone = '+593990000004'
  where id = '10000000-0000-0000-0000-000000000004';
update public.profiles set role = 'reader', birth_date = '2000-09-30', phone = '+593990000005'
  where id = '10000000-0000-0000-0000-000000000005';

-- ----------------------------------------------------------------------------
-- 3. Articles
-- ----------------------------------------------------------------------------
-- ART1, ART3, ART4 son públicos. ART2 y ART5 son borradores privados
-- (uno por cada writer), útiles para validar las políticas RLS.
insert into public.articles (id, author_id, title, summary, document_path, image_path, is_public, created_at) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   'Introducción a PostgreSQL', 'Conceptos básicos de PostgreSQL para nuevos desarrolladores.',
   'articles/20000000-0000-0000-0000-000000000001/document.pdf',
   'articles/20000000-0000-0000-0000-000000000001/cover.jpg', true, now() - interval '10 days'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
   'Borrador: optimización de índices', 'Notas internas, aún sin publicar.',
   'articles/20000000-0000-0000-0000-000000000002/document.pdf',
   null, false, now() - interval '2 days'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
   'Guía de Next.js 15', 'Novedades del App Router y Server Components.',
   'articles/20000000-0000-0000-0000-000000000003/document.pdf',
   'articles/20000000-0000-0000-0000-000000000003/cover.jpg', true, now() - interval '7 days'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003',
   'Row Level Security explicado', 'Cómo funcionan las políticas RLS en Supabase.',
   'articles/20000000-0000-0000-0000-000000000004/document.pdf',
   'articles/20000000-0000-0000-0000-000000000004/cover.jpg', true, now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003',
   'Borrador: arquitectura escalable', 'Ideas preliminares, pendiente de revisión.',
   'articles/20000000-0000-0000-0000-000000000005/document.pdf',
   null, false, now() - interval '1 days');

-- ----------------------------------------------------------------------------
-- 4. Comments (solo sobre artículos públicos)
-- ----------------------------------------------------------------------------
insert into public.comments (article_id, user_id, comment, created_at) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
   'Muy buena introducción, gracias!', now() - interval '9 days'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005',
   '¿Podrías profundizar en índices compuestos?', now() - interval '8 days'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
   'Excelente resumen, lo voy a compartir.', now() - interval '8 days'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004',
   'Justo lo que necesitaba para migrar mi proyecto.', now() - interval '6 days'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
   'Buen material para el curso.', now() - interval '2 days');

-- ----------------------------------------------------------------------------
-- 5. Likes (respeta UNIQUE(article_id, user_id))
-- ----------------------------------------------------------------------------
insert into public.likes (article_id, user_id, created_at) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', now() - interval '9 days'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', now() - interval '8 days'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', now() - interval '8 days'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', now() - interval '6 days'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', now() - interval '2 days'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', now() - interval '5 days');

-- ----------------------------------------------------------------------------
-- 6. Views (eventos independientes, sin contador; repeticiones permitidas)
-- ----------------------------------------------------------------------------
insert into public.views (article_id, user_id, viewed_at) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', now() - interval '9 days'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', now() - interval '5 days'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', now() - interval '8 days'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now() - interval '7 days'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', now() - interval '6 days'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', now() - interval '4 days'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', now() - interval '2 days'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', now() - interval '1 days');

-- ----------------------------------------------------------------------------
-- 7. Favorites (respeta UNIQUE(article_id, user_id))
-- ----------------------------------------------------------------------------
insert into public.favorites (article_id, user_id, created_at) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', now() - interval '9 days'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', now() - interval '6 days'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', now() - interval '2 days'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', now() - interval '5 days');
