import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@readhub/types";

// El tipo de retorno se fija explícitamente a SupabaseClient<Database> (de
// supabase-js): @supabase/ssr 0.5.x no propaga bien el genérico Schema con
// supabase-js 2.110 y las operaciones quedarían tipadas como `never`.
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ) as unknown as SupabaseClient<Database>;
}
