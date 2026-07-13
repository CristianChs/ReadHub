-- ============================================================================
-- El trigger de creación de perfil ahora captura también birth_date y phone
-- desde la metadata del signup. Así los datos del registro se guardan aunque
-- no exista sesión inmediata (p. ej. con confirmación de correo activada).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, birth_date, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;
