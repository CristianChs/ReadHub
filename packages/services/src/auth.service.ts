import type { User } from "@supabase/supabase-js";

import type { TypedSupabaseClient } from "@readhub/database";
import type { LoginInput, RegisterInput } from "@readhub/types";
import type { Profile } from "@readhub/types";

// ============================================================================
// auth.service — única puerta de entrada a Supabase Auth y a la tabla profiles.
// Todas las funciones lanzan el error de Supabase en caso de fallo; los hooks
// que las consuman deben capturarlo (try/catch).
// ============================================================================

// Nombre para mostrar por defecto a partir del correo (parte antes de @).
// El registro no captura un nombre; el usuario podrá editarlo más adelante.
function displayNameFromEmail(email: string): string {
  return email.split("@")[0] || email;
}

async function register(supabase: TypedSupabaseClient, input: RegisterInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    // full_name lo consume el trigger handle_new_user al crear el perfil.
    // birth_date/phone se guardan también como respaldo en la metadata.
    options: {
      data: {
        full_name: displayNameFromEmail(input.email),
        birth_date: input.birthDate ?? null,
        phone: input.phone ?? null,
      },
    },
  });
  if (error) throw error;

  // El trigger on_auth_user_created ya insertó el perfil con valores por
  // defecto. Si hay sesión activa, completamos fecha de nacimiento y teléfono
  // (permitido por la política profiles_update_own).
  const userId = data.user?.id;
  if (userId && data.session) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        birth_date: input.birthDate ?? null,
        phone: input.phone ?? null,
      })
      .eq("id", userId);
    if (profileError) throw profileError;
  }

  return data;
}

async function login(supabase: TypedSupabaseClient, input: LoginInput) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) throw error;
  return data;
}

async function logout(supabase: TypedSupabaseClient): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Usuario autenticado actual (o null si no hay sesión).
async function getCurrentUser(
  supabase: TypedSupabaseClient,
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Suscripción a cambios de sesión (login/logout, expiración de token, cambios
// en otra pestaña). Devuelve una función para cancelar la suscripción. Se
// encapsula aquí para que toda interacción con Supabase Auth viva en el service.
function onAuthChange(
  supabase: TypedSupabaseClient,
  callback: (user: User | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

// Perfil público del usuario (fila de la tabla profiles).
async function getProfile(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Nombres de autor para un conjunto de ids (vista pública author_profiles).
// Devuelve un mapa id -> nombre para mostrar, con respaldo cuando no hay
// full_name registrado.
async function getAuthorNames(
  supabase: TypedSupabaseClient,
  ids: string[],
): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from("author_profiles")
    .select("id, full_name")
    .in("id", uniqueIds);
  if (error) throw error;

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.full_name ?? "Autor";
  }
  return map;
}

export const authService = {
  register,
  login,
  logout,
  getCurrentUser,
  onAuthChange,
  getProfile,
  getAuthorNames,
};
