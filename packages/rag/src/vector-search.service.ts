import type { TypedSupabaseClient } from "@readhub/database";
import { toVectorLiteral } from "@readhub/ai";
import { embeddingService } from "./embedding.service";
import type { Embedding } from "@readhub/types";
import type {
  RetrievedArticle,
  RetrievedChunk,
  VectorSearchOptions,
  VectorSearchResult,
} from "@readhub/types";

// ============================================================================
// vector-search.service — recuperación semántica.
//
// Responsabilidad única: dada una consulta, devolver los fragmentos más
// relevantes de la base vectorial, ordenados.
//
// NO construye contexto. NO habla con Claude. NO genera embeddings por su
// cuenta: delega en embedding.service. La similitud la calcula PostgreSQL a
// través de la función match_article_chunks (índice HNSW).
// ============================================================================

/**
 * Top-K por defecto.
 * Cada fragmento ronda los 1.200 caracteres (~300 tokens), así que 5 fragmentos
 * aportan ~1.500 tokens de contexto: suficiente para fundamentar una respuesta
 * sin desplazar la pregunta ni la instrucción del sistema en el prompt.
 */
export const DEFAULT_TOP_K = 5;

/**
 * Umbral de similitud por defecto.
 *
 * Es el mecanismo que permite responder "no tengo información sobre eso"
 * (Caso 4 de la spec) en lugar de alucinar sobre fragmentos irrelevantes:
 * si nada supera el umbral, no hay contexto y el LLM no debe inventar.
 *
 * 0.4 es una posición conservadora sobre coseno con vectores normalizados:
 *   - más alto  -> falsos negativos: la plataforma "no sabe" cosas que sí tiene.
 *   - más bajo  -> ruido: fragmentos irrelevantes contaminan el contexto.
 *
 * 0.3 es el valor calibrado midiendo consultas reales contra el corpus real:
 * los aciertos genuinos con voyage-4 caen en ~0.42-0.51 para la consulta escueta,
 * pero al envolverla en lenguaje natural ("¿Qué dice ReadHub sobre…?") la
 * similitud baja varias décimas; con 0.4 esas consultas legítimas se quedaban sin
 * contexto. 0.3 da margen para el fraseo conversacional sin dejar entrar ruido.
 */
export const DEFAULT_THRESHOLD = 0.3;

/** Límites duros para que un llamador no pueda pedir un contexto desbordado. */
const MAX_TOP_K = 20;

function resolveOptions(
  options?: VectorSearchOptions,
): Required<VectorSearchOptions> {
  const topK = Math.min(Math.max(options?.topK ?? DEFAULT_TOP_K, 1), MAX_TOP_K);
  const threshold = Math.min(Math.max(options?.threshold ?? DEFAULT_THRESHOLD, 0), 1);
  return { topK, threshold };
}

/** Agrupa los fragmentos por artículo conservando el orden por relevancia. */
function groupByArticle(chunks: RetrievedChunk[]): RetrievedArticle[] {
  const byArticle = new Map<string, RetrievedArticle>();

  // `chunks` ya viene ordenado desc por similitud, así que el primero que se
  // ve de cada artículo es su mejor fragmento y define su `score`.
  for (const chunk of chunks) {
    const existing = byArticle.get(chunk.articleId);
    if (existing) {
      existing.chunks.push(chunk);
    } else {
      byArticle.set(chunk.articleId, {
        articleId: chunk.articleId,
        title: chunk.title,
        score: chunk.similarity,
        chunks: [chunk],
      });
    }
  }

  return [...byArticle.values()].sort((a, b) => b.score - a.score);
}

/**
 * Busca por similitud a partir de un embedding ya calculado.
 *
 * Se expone aparte de `search` a propósito: permite recuperar sin depender del
 * proveedor de embeddings (reutilización y verificación del motor de ranking).
 */
async function searchByEmbedding(
  supabase: TypedSupabaseClient,
  embedding: Embedding,
  options?: VectorSearchOptions,
): Promise<RetrievedChunk[]> {
  const { topK, threshold } = resolveOptions(options);

  const { data, error } = await supabase.rpc("match_article_chunks", {
    query_embedding: toVectorLiteral(embedding),
    match_threshold: threshold,
    match_count: topK,
  });
  if (error) throw error;

  // La función SQL ya ordena por distancia ascendente (= similitud descendente)
  // usando el índice HNSW. No se reordena en cliente.
  return (data ?? []).map((row) => ({
    articleId: row.article_id,
    title: row.article_title,
    chunkIndex: row.chunk_index,
    content: row.content,
    similarity: row.similarity,
  }));
}

/**
 * Recuperación completa: consulta en lenguaje natural -> fragmentos relevantes.
 *
 *   texto -> embedding ("query") -> similitud coseno -> Top-K -> estructurado
 */
async function search(
  supabase: TypedSupabaseClient,
  query: string,
  options?: VectorSearchOptions,
): Promise<VectorSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("La consulta no puede estar vacía.");
  }

  // input_type "query": Voyage proyecta consultas y documentos de forma
  // distinta; usar el tipo correcto mejora la calidad de recuperación.
  const embedding = await embeddingService.embedQuery(trimmed);
  const chunks = await searchByEmbedding(supabase, embedding, options);

  return {
    query: trimmed,
    chunks,
    articles: groupByArticle(chunks),
    applied: resolveOptions(options),
  };
}

export const vectorSearchService = {
  search,
  searchByEmbedding,
  groupByArticle,
};
