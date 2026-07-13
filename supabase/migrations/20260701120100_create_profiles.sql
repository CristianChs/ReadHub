-- profiles: relación 1:1 con auth.users (mismo UUID como PK y FK).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  birth_date date,
  phone text,
  role text not null default 'reader' check (role in ('reader', 'writer', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público de cada usuario autenticado en la plataforma.';
comment on column public.profiles.role is 'reader, writer o admin.';

alter table public.profiles enable row level security;

-- Crea automáticamente el perfil correspondiente cuando se registra un usuario en auth.users.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
