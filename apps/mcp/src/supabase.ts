import { createClient } from "@supabase/supabase-js";
import type { TypedSupabaseClient } from "@readhub/database";
import type { Database } from "@readhub/types";

import { getSupabaseEnv } from "./config/env.js";

/**
 * Cliente Supabase del servidor MCP.
 *
 * Es la pieza que **desacopla este servidor de la aplicación web**: usa
 * `@supabase/supabase-js` directamente, sin `next/headers` ni `next/server`.
 * Por eso los clientes de Next se quedaron en `apps/web`.
 *
 * El tipo devuelto es exactamente el que esperan los services compartidos
 * (`TypedSupabaseClient`), que reciben el cliente **como parámetro**. Ese
 * contrato es lo que permite reutilizarlos aquí sin duplicar una línea.
 *
 * Sin sesión ni refresco de token: un proceso MCP no es un navegador.
 */
export function createSupabaseClient(): TypedSupabaseClient {
  const { url, key } = getSupabaseEnv();

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
