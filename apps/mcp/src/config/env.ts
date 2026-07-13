/**
 * Configuración del servidor MCP a partir del entorno.
 *
 * No hay lógica de negocio aquí: solo lectura y validación de variables.
 */

export interface SupabaseEnv {
  url: string;
  key: string;
}

/**
 * Credenciales de Supabase.
 *
 * Se usa deliberadamente la **anon key**, no la service role: así el servidor
 * MCP queda sujeto a las mismas políticas RLS que la aplicación web. Un
 * artículo en borrador ajeno seguirá siendo invisible, y la función
 * `match_article_chunks` seguirá filtrando por `is_public`.
 *
 * Se aceptan los nombres `NEXT_PUBLIC_*` como respaldo para poder reutilizar el
 * `.env.local` existente durante el desarrollo, pero los nombres canónicos de
 * este servidor no llevan ese prefijo: no es una aplicación de navegador.
 */
export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan credenciales de Supabase. Define SUPABASE_URL y SUPABASE_ANON_KEY.",
    );
  }

  return { url, key };
}
