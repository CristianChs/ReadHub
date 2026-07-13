-- ============================================================================
-- profiles.full_name: nombre para mostrar del autor.
-- El formulario de registro no captura un nombre, por lo que se deriva del
-- correo (parte antes de @) en el momento del registro y puede editarse luego.
-- ============================================================================

alter table public.profiles
  add column if not exists full_name text;

-- Se reemplaza el trigger para que, al crear el usuario, tome el nombre desde
-- la metadata (raw_user_meta_data.full_name) que envía auth.service.register.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Exposición segura del autor.
-- La tabla profiles solo es legible por su dueño (profiles_select_own), y
-- contiene datos sensibles (teléfono, fecha de nacimiento). Para mostrar el
-- nombre del autor a otros usuarios se expone una vista con SOLO id + full_name.
-- La vista corre con privilegios del creador (security_invoker off), de modo
-- que puede leer full_name sin exponer el resto de columnas.
-- ----------------------------------------------------------------------------
create or replace view public.author_profiles
  with (security_invoker = off)
  as select id, full_name from public.profiles;

-- La app está detrás de login: solo usuarios autenticados necesitan resolver
-- nombres de autor. Se restringe a `authenticated` para minimizar superficie.
-- Nota: el linter marca la vista como SECURITY DEFINER; es intencional y seguro
-- porque expone únicamente id + full_name (ningún dato sensible).
revoke all on public.author_profiles from anon;
grant select on public.author_profiles to authenticated;
