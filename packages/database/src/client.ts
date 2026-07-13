import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@readhub/types";

// Cliente Supabase tipado. Se usa el SupabaseClient base de supabase-js con el
// esquema Database (los helpers de @supabase/ssr 0.5.x no propagan bien el
// genérico Schema con supabase-js 2.110). Los services reciben una instancia
// como parámetro, de modo que funcionan igual con el cliente de navegador
// (hooks) o el de servidor (route handlers), sin acoplarse a un runtime.
export type TypedSupabaseClient = SupabaseClient<Database>;
