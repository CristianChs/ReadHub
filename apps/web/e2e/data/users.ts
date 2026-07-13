// ============================================================================
// DATOS DE PRUEBA. Ni selectores, ni lógica: solo el "quién".
//
// Se leen de variables de entorno con un valor por defecto, para que la misma
// suite corra contra cualquier instancia sin editar una línea:
//
//   - En CI: contra el Supabase local y efímero que levanta el workflow, ya
//     sembrado por `supabase/seed.sql` (de ahí los valores por defecto).
//   - En local contra un Supabase alojado, donde ese usuario sembrado no
//     existe, se apunta a otro sin tocar el código:
//
//       E2E_USER_EMAIL=demo@readhub.dev E2E_USER_PASSWORD=ReadHub123 npm run test:e2e
//
// Ninguna credencial de producción vive aquí: son usuarios de prueba con
// contraseñas públicas y conocidas, creados para eso.
// ============================================================================

export interface TestUser {
  email: string;
  password: string;
}

/** Usuario válido y sembrado. Rol "writer": puede publicar. */
export const VALID_USER: TestUser = {
  email: process.env.E2E_USER_EMAIL ?? "writer1@readhub.test",
  password: process.env.E2E_USER_PASSWORD ?? "ReadHub123!",
};

/** Existe el correo, pero la contraseña es incorrecta. */
export const WRONG_PASSWORD_USER: TestUser = {
  email: VALID_USER.email,
  password: "contraseña-que-no-es",
};

/** Correo bien formado que no corresponde a ninguna cuenta. */
export const UNKNOWN_USER: TestUser = {
  email: "nadie-registrado-aqui@readhub.test",
  password: "LoQueSea123!",
};
