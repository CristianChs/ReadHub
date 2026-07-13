-- Extensiones requeridas para la generación de UUIDs (gen_random_uuid()).
create extension if not exists "pgcrypto" with schema extensions;
