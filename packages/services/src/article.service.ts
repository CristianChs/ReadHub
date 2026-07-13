import type { TypedSupabaseClient } from "@readhub/database";
import type { Database } from "@readhub/types";
import type {
  Article,
  ArticleDetail,
  ArticleListItem,
  CreateArticleInput,
  UpdateArticleInput,
} from "@readhub/types";

// ============================================================================
// article.service — artículos y sus interacciones de conteo (views y likes).
// Única puerta de entrada a Supabase para estos recursos.
//
// Los contadores de views/likes se leen de la vista agregada `article_stats`
// (las políticas RLS de esas tablas impiden contarlas directamente desde el
// cliente sin exponer quién interactuó).
// ============================================================================

interface ArticleRow {
  id: string;
  title: string;
  summary: string | null;
  image_path: string | null;
  author_id: string;
  created_at: string;
  category_id: string | null;
}

interface ArticleDetailRow extends ArticleRow {
  document_path: string | null;
  is_public: boolean;
}

interface Stats {
  views: number;
  likes: number;
}

const EMPTY_STATS: Stats = { views: 0, likes: 0 };

const LIST_SELECT =
  "id, title, summary, image_path, author_id, created_at, category_id";
const DETAIL_SELECT = `${LIST_SELECT}, document_path, is_public`;

// Mapa article_id -> contadores para un conjunto de artículos.
async function getStatsMap(
  supabase: TypedSupabaseClient,
  ids: string[],
): Promise<Record<string, Stats>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("article_stats")
    .select("article_id, views_count, likes_count")
    .in("article_id", ids);
  if (error) throw error;

  const map: Record<string, Stats> = {};
  for (const row of data ?? []) {
    map[row.article_id] = {
      views: row.views_count ?? 0,
      likes: row.likes_count ?? 0,
    };
  }
  return map;
}

function mapListItem(row: ArticleRow, stats: Stats): ArticleListItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    imagePath: row.image_path,
    authorId: row.author_id,
    createdAt: row.created_at,
    categoryId: row.category_id,
    views: stats.views,
    likes: stats.likes,
  };
}

// --- Artículos ---------------------------------------------------------------

// Listado de artículos públicos, del más reciente al más antiguo.
async function list(supabase: TypedSupabaseClient): Promise<ArticleListItem[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(LIST_SELECT)
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as ArticleRow[];
  const stats = await getStatsMap(
    supabase,
    rows.map((row) => row.id),
  );
  return rows.map((row) => mapListItem(row, stats[row.id] ?? EMPTY_STATS));
}

/**
 * Neutraliza los metacaracteres que el usuario no debe controlar.
 *
 * PostgREST separa los filtros de `or` por comas y los agrupa con paréntesis; y
 * dentro de un patrón `ilike`, `%` y `_` son comodines. Si cualquiera de esos
 * caracteres llega desde la consulta, el filtro deja de significar lo que dice.
 */
function escapeIlikeTerm(value: string): string {
  return value
    .replace(/[,()%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Búsqueda léxica sobre artículos públicos: coincidencias literales en el
 * título o el resumen.
 *
 * Es complementaria a la búsqueda semántica de `@readhub/rag`, no un sustituto:
 * encuentra un artículo por su nombre exacto aunque todavía no esté indexado en
 * la base vectorial, cosa que la semántica no puede hacer.
 */
async function search(
  supabase: TypedSupabaseClient,
  query: string,
  limit = 20,
): Promise<ArticleListItem[]> {
  const term = escapeIlikeTerm(query);
  if (!term) return [];

  const { data, error } = await supabase
    .from("articles")
    .select(LIST_SELECT)
    .eq("is_public", true)
    .or(`title.ilike.%${term}%,summary.ilike.%${term}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as ArticleRow[];
  const stats = await getStatsMap(
    supabase,
    rows.map((row) => row.id),
  );
  return rows.map((row) => mapListItem(row, stats[row.id] ?? EMPTY_STATS));
}

// Artículos de un autor concreto (incluye borradores no públicos: la política
// articles_select_own permite al autor ver los suyos).
async function listByAuthor(
  supabase: TypedSupabaseClient,
  authorId: string,
): Promise<ArticleListItem[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(LIST_SELECT)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as ArticleRow[];
  const stats = await getStatsMap(
    supabase,
    rows.map((row) => row.id),
  );
  return rows.map((row) => mapListItem(row, stats[row.id] ?? EMPTY_STATS));
}

async function getById(
  supabase: TypedSupabaseClient,
  id: string,
): Promise<ArticleDetail | null> {
  const { data, error } = await supabase
    .from("articles")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as ArticleDetailRow;
  const stats = await getStatsMap(supabase, [row.id]);
  return {
    ...mapListItem(row, stats[row.id] ?? EMPTY_STATS),
    documentPath: row.document_path,
    isPublic: row.is_public,
  };
}

// Crea un artículo. Por defecto se publica (is_public = true) para que aparezca
// de inmediato en el listado tras publicarlo.
async function create(
  supabase: TypedSupabaseClient,
  input: CreateArticleInput,
): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .insert({
      author_id: input.authorId,
      title: input.title,
      summary: input.summary ?? null,
      document_path: input.documentPath ?? null,
      image_path: input.imagePath ?? null,
      is_public: input.isPublic ?? true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function update(
  supabase: TypedSupabaseClient,
  id: string,
  input: UpdateArticleInput,
): Promise<Article> {
  // Mapea el modelo de aplicación (camelCase) a las columnas de la BD.
  const patch: Database["public"]["Tables"]["articles"]["Update"] = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.isPublic !== undefined) patch.is_public = input.isPublic;

  const { data, error } = await supabase
    .from("articles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function remove(
  supabase: TypedSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) throw error;
}

// --- Views (visualizaciones) -------------------------------------------------

// Registra una visualización (un evento por apertura).
async function registerView(
  supabase: TypedSupabaseClient,
  articleId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("views")
    .insert({ article_id: articleId, user_id: userId });
  if (error) throw error;
}

async function getViewCount(
  supabase: TypedSupabaseClient,
  articleId: string,
): Promise<number> {
  const stats = await getStatsMap(supabase, [articleId]);
  return stats[articleId]?.views ?? 0;
}

// --- Likes -------------------------------------------------------------------

async function getLikeCount(
  supabase: TypedSupabaseClient,
  articleId: string,
): Promise<number> {
  const stats = await getStatsMap(supabase, [articleId]);
  return stats[articleId]?.likes ?? 0;
}

// ¿El usuario ya dio "Me gusta" a este artículo?
async function hasLiked(
  supabase: TypedSupabaseClient,
  articleId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("likes")
    .select("id")
    .eq("article_id", articleId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

// Registra un "Me gusta". La restricción unique(article_id, user_id) impide
// duplicados a nivel de BD.
async function addLike(
  supabase: TypedSupabaseClient,
  articleId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("likes")
    .insert({ article_id: articleId, user_id: userId });
  if (error) throw error;
}

async function removeLike(
  supabase: TypedSupabaseClient,
  articleId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("article_id", articleId)
    .eq("user_id", userId);
  if (error) throw error;
}

export const articleService = {
  list,
  search,
  listByAuthor,
  getById,
  create,
  update,
  remove,
  registerView,
  getViewCount,
  getLikeCount,
  hasLiked,
  addLike,
  removeLike,
};
