import type { TypedSupabaseClient } from "@readhub/database";
import type { Category, CategoryWithCount } from "@readhub/types";

// ============================================================================
// category.service — catálogo de categorías temáticas.
// Única puerta de entrada a Supabase para este recurso.
//
// El catálogo es de lectura pública; su escritura se gestiona fuera de la app
// (service_role / dashboard), por eso aquí solo hay lecturas.
// ============================================================================

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
  };
}

/** Catálogo completo, ordenado alfabéticamente por nombre. */
async function list(supabase: TypedSupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, description, created_at")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapCategory);
}

/**
 * Catálogo con el número de artículos PÚBLICOS de cada categoría.
 *
 * El conteo se hace en dos consultas y se agrega en memoria, en lugar de un
 * conteo embebido de PostgREST: mantiene el filtro `is_public` explícito y no
 * depende de que la relación FK esté expuesta en la API. Las RLS ya impiden que
 * un artículo no público entre en el recuento.
 */
async function listWithCounts(
  supabase: TypedSupabaseClient,
): Promise<CategoryWithCount[]> {
  const categories = await list(supabase);

  const { data, error } = await supabase
    .from("articles")
    .select("category_id")
    .eq("is_public", true)
    .not("category_id", "is", null);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.category_id;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return categories.map((category) => ({
    ...category,
    articleCount: counts.get(category.id) ?? 0,
  }));
}

export const categoryService = {
  list,
  listWithCounts,
};
