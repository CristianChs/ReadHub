import type { TypedSupabaseClient } from "@readhub/database";
import { sanitizeText } from "@readhub/shared";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  createEmbedding,
  createEmbeddings,
  toVectorLiteral,
} from "@readhub/ai";
import type {
  ArticleEmbeddingInput,
  Embedding,
  EmbedArticleResult,
} from "@readhub/types";

// ============================================================================
// embedding.service — genera y persiste las representaciones vectoriales del
// conocimiento de ReadHub. Centraliza TODA la lógica de embeddings:
//
//   componer texto -> fragmentar -> vectorizar -> validar -> persistir
//
// Ningún otro módulo conoce al proveedor: este service depende de la
// abstracción `lib/ai/embeddings`, no de Voyage AI.
//
// La ejecución es manual (no hay indexación automática todavía).
// ============================================================================

/**
 * Tamaño objetivo de cada fragmento, en caracteres.
 * Un fragmento debe ser lo bastante grande para tener sentido por sí solo y
 * lo bastante pequeño para que la similitud no se diluya entre varios temas.
 */
const MAX_CHUNK_CHARS = 1200;

/**
 * Solape entre fragmentos consecutivos. Evita que una idea que cae justo en
 * la frontera entre dos fragmentos quede partida y deje de ser recuperable.
 */
const CHUNK_OVERLAP_CHARS = 150;

// --- Composición del texto a vectorizar --------------------------------------

/**
 * Cabecera de contexto que se antepone a CADA fragmento antes de vectorizarlo.
 *
 * Un fragmento tomado del centro de un PDF pierde el tema del que habla. Al
 * anteponer título y resumen, el vector queda anclado semánticamente al
 * artículo, de modo que una consulta como "¿qué dice ReadHub sobre SCRUM?"
 * recupera también los fragmentos internos que nunca mencionan la palabra.
 */
export function buildContextHeader(
  input: Pick<ArticleEmbeddingInput, "title" | "summary">,
): string {
  const lines = [`Título: ${input.title.trim()}`];
  const summary = input.summary?.trim();
  if (summary) lines.push(`Resumen: ${summary}`);
  return lines.join("\n");
}

/**
 * Divide el texto en fragmentos respetando los límites de párrafo cuando es
 * posible, y con solape. Un párrafo más largo que el máximo se parte por
 * tamaño (con el mismo solape).
 */
export function chunkText(
  text: string,
  maxChars: number = MAX_CHUNK_CHARS,
  overlap: number = CHUNK_OVERLAP_CHARS,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const value = current.trim();
    if (value) chunks.push(value);
    current = "";
  };

  for (const paragraph of paragraphs) {
    // Párrafo que por sí solo excede el máximo: se parte por tamaño.
    if (paragraph.length > maxChars) {
      flush();
      const step = Math.max(maxChars - overlap, 1);
      for (let i = 0; i < paragraph.length; i += step) {
        chunks.push(paragraph.slice(i, i + maxChars).trim());
        if (i + maxChars >= paragraph.length) break;
      }
      continue;
    }

    // Cabe en el fragmento actual.
    if (current.length + paragraph.length + 2 <= maxChars) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }

    // No cabe: cerramos el actual y arrancamos otro con solape del anterior.
    // El solape solo puede ocupar el hueco que deje el párrafo: si el párrafo
    // ya llena el fragmento, se recorta (o se omite) para no superar el máximo.
    flush();
    const room = maxChars - paragraph.length - 2;
    const tail =
      room > 0
        ? (chunks.at(-1)?.slice(-Math.min(overlap, room)).trim() ?? "")
        : "";
    current = tail ? `${tail}\n\n${paragraph}` : paragraph;
  }

  flush();

  // `slice` corta por unidades de código UTF-16 y puede partir un par sustituto
  // por la mitad, generando un sustituto suelto que ni JSON ni Postgres admiten
  // (22P02). Se sanea la salida, no solo la entrada.
  return chunks.map(sanitizeText).filter((chunk) => chunk.length > 0);
}

/**
 * Construye los fragmentos definitivos de un artículo.
 * Devuelve, por cada fragmento, el texto que se ALMACENA y el que se VECTORIZA.
 *
 * Se almacena el fragmento desnudo y se vectoriza el fragmento con cabecera:
 * el título se vuelve a adjuntar en la recuperación (la función SQL ya devuelve
 * `article_title`), así que duplicarlo en el contexto sería desperdiciar tokens.
 */
export function buildArticleChunks(
  input: ArticleEmbeddingInput,
): { stored: string; embedded: string }[] {
  const header = buildContextHeader(input);
  const body = input.content?.trim();

  // Sin documento legible, el artículo sigue siendo indexable por su metadata.
  if (!body) {
    return [{ stored: header, embedded: header }];
  }

  return chunkText(body).map((chunk) => ({
    stored: chunk,
    embedded: `${header}\n\n${chunk}`,
  }));
}

// --- Validación ---------------------------------------------------------------

/**
 * Segunda barrera de validación (la primera está en lib/ai/embeddings).
 * Garantiza consistencia entre fragmentos y vectores antes de tocar la BD.
 */
function assertConsistent(chunks: unknown[], embeddings: Embedding[]): void {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `Inconsistencia: ${chunks.length} fragmentos frente a ${embeddings.length} embeddings.`,
    );
  }
  embeddings.forEach((embedding, index) => {
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `El embedding ${index} tiene ${embedding.length} dimensiones; ` +
          `la base vectorial espera ${EMBEDDING_DIMENSIONS}.`,
      );
    }
  });
}

// --- Persistencia -------------------------------------------------------------

/** Elimina los vectores de un artículo. Base de la reindexación idempotente. */
async function removeArticleEmbeddings(
  supabase: TypedSupabaseClient,
  articleId: string,
): Promise<void> {
  const { error } = await supabase
    .from("article_embeddings")
    .delete()
    .eq("article_id", articleId);
  if (error) throw error;
}

/**
 * Vectoriza un artículo y almacena sus fragmentos.
 *
 * Idempotente: borra los fragmentos previos antes de insertar los nuevos, de
 * modo que reindexar nunca produce duplicados (la restricción
 * unique(article_id, chunk_index) es la garantía final a nivel de BD).
 */
async function embedArticle(
  supabase: TypedSupabaseClient,
  input: ArticleEmbeddingInput,
): Promise<EmbedArticleResult> {
  const chunks = buildArticleChunks(input);
  if (chunks.length === 0) {
    throw new Error("El artículo no contiene texto vectorizable.");
  }

  // 1) Vectorizar (input_type "document": es contenido a indexar, no una consulta).
  const embeddings = await createEmbeddings(
    chunks.map((chunk) => chunk.embedded),
    "document",
  );

  // 2) Validar antes de persistir.
  assertConsistent(chunks, embeddings);

  // 3) Reemplazar de forma idempotente.
  await removeArticleEmbeddings(supabase, input.articleId);

  const rows = chunks.map((chunk, index) => ({
    article_id: input.articleId,
    chunk_index: index,
    content: chunk.stored,
    embedding: toVectorLiteral(embeddings[index]),
  }));

  const { error } = await supabase.from("article_embeddings").insert(rows);
  if (error) throw error;

  return {
    articleId: input.articleId,
    chunks: rows.length,
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  };
}

/**
 * Vectoriza una consulta en lenguaje natural.
 * No busca nada: solo devuelve el vector. Lo consumirá vector-search.service.
 */
async function embedQuery(text: string): Promise<Embedding> {
  const query = text.trim();
  if (!query) throw new Error("La consulta no puede estar vacía.");
  return createEmbedding(query, "query");
}

export const embeddingService = {
  embedArticle,
  embedQuery,
  removeArticleEmbeddings,
  // Expuestas para reutilización y verificación; son funciones puras.
  buildArticleChunks,
  buildContextHeader,
  chunkText,
};
