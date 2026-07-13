import { SYSTEM_PROMPT, buildUserPrompt } from "@readhub/ai";
import type {
  BuiltContext,
  ContextBuilderOptions,
  ContextDocument,
  ContextDropStats,
  ContextSource,
} from "@readhub/types";
import type { RetrievedChunk } from "@readhub/types";

// ============================================================================
// context-builder.service — puente entre el motor de recuperación y el LLM.
//
// Recibe la consulta y los fragmentos recuperados (con sus puntuaciones) y
// devuelve un prompt estructurado, acotado y trazable.
//
// NO busca. NO llama a ningún proveedor de IA. Es una función pura: mismos
// datos de entrada => mismo prompt de salida.
// ============================================================================

/**
 * Similitud mínima para que un fragmento merezca ocupar contexto. Alineada con
 * DEFAULT_THRESHOLD de vector-search: es la segunda puerta al mismo criterio, y
 * si fuera más alta re-filtraría lo que la búsqueda ya dejó pasar. Calibrada a
 * 0.3 con consultas reales (ver la nota en vector-search.service).
 */
export const DEFAULT_MIN_SIMILARITY = 0.3;

/** Nº máximo de fragmentos en el contexto. */
export const DEFAULT_MAX_DOCUMENTS = 5;

/**
 * Presupuesto de contexto expresado en TOKENS, no en caracteres: es la unidad
 * que factura el modelo y la que limita su ventana. Fácilmente configurable.
 */
export const DEFAULT_TOKEN_BUDGET = 2000;

/**
 * Aproximación conservadora para español: ~4 caracteres por token.
 * Evita depender de un tokenizador en el camino crítico.
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Cobertura léxica por encima de la cual un fragmento se considera redundante:
 * si el 85% de su vocabulario ya está en el contexto, aporta <15% de novedad.
 */
export const DEFAULT_REDUNDANCY_THRESHOLD = 0.85;

/** Un fragmento con muy poco texto real (números de página, cabeceras) no aporta. */
const MIN_MEANINGFUL_LETTERS = 25;

function resolveOptions(options?: ContextBuilderOptions) {
  return {
    minSimilarity: options?.minSimilarity ?? DEFAULT_MIN_SIMILARITY,
    maxDocuments: options?.maxDocuments ?? DEFAULT_MAX_DOCUMENTS,
    tokenBudget: options?.tokenBudget ?? DEFAULT_TOKEN_BUDGET,
    redundancyThreshold:
      options?.redundancyThreshold ?? DEFAULT_REDUNDANCY_THRESHOLD,
  };
}

// --- Calidad -----------------------------------------------------------------

/** Descarta fragmentos sin contenido textual útil. */
function hasMeaningfulContent(content: string): boolean {
  const letters = content.replace(/[^\p{L}]/gu, "").length;
  return letters >= MIN_MEANINGFUL_LETTERS;
}

// --- Redundancia --------------------------------------------------------------

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // quita tildes
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 2),
  );
}

/**
 * Cobertura dirigida: qué fracción del vocabulario del fragmento CANDIDATO ya
 * está presente en un fragmento ya seleccionado. 1 = no aporta nada nuevo.
 *
 * Se prefiere a Jaccard a propósito. Jaccard penaliza la diferencia de tamaño:
 * un fragmento que repite todo el anterior y añade unas palabras baja de umbral
 * y se cuela. La cobertura responde a la pregunta correcta: "¿cuánta información
 * NUEVA aporta este fragmento?". Es dirigida (candidato -> seleccionado) para no
 * descartar un fragmento largo e informativo solo porque contiene a uno corto.
 */
function coverage(candidate: Set<string>, selected: Set<string>): number {
  if (candidate.size === 0) return 1;
  let intersection = 0;
  for (const word of candidate) if (selected.has(word)) intersection++;
  return intersection / candidate.size;
}

// --- Selección ----------------------------------------------------------------

/**
 * Filtra los fragmentos recuperados y devuelve los que merecen entrar en el
 * contexto, en orden de relevancia, contabilizando por qué se descarta cada uno.
 *
 * Los fragmentos llegan ya ordenados desc por similitud desde vector-search.
 */
function selectDocuments(
  chunks: RetrievedChunk[],
  options: ReturnType<typeof resolveOptions>,
): { documents: ContextDocument[]; dropped: ContextDropStats; charsUsed: number } {
  const charBudget = options.tokenBudget * CHARS_PER_TOKEN;
  const dropped: ContextDropStats = {
    belowThreshold: 0,
    lowQuality: 0,
    redundant: 0,
    overMaxDocuments: 0,
    overBudget: 0,
  };

  const documents: ContextDocument[] = [];
  const selectedTokens: Set<string>[] = [];
  let charsUsed = 0;

  for (const chunk of chunks) {
    // 1. Relevancia: por debajo del umbral no justifica ocupar contexto.
    if (chunk.similarity < options.minSimilarity) {
      dropped.belowThreshold++;
      continue;
    }

    // 2. Calidad: texto sin sustancia (paginación, cabeceras sueltas).
    if (!hasMeaningfulContent(chunk.content)) {
      dropped.lowQuality++;
      continue;
    }

    // 3. Redundancia: el solape de fragmentos (150 chars) y los documentos que
    //    repiten ideas harían al LLM leer dos veces lo mismo.
    const tokens = tokenize(chunk.content);
    const isRedundant = selectedTokens.some(
      (selected) => coverage(tokens, selected) >= options.redundancyThreshold,
    );
    if (isRedundant) {
      dropped.redundant++;
      continue;
    }

    // 4. Tope de documentos.
    if (documents.length >= options.maxDocuments) {
      dropped.overMaxDocuments++;
      continue;
    }

    // 5. Presupuesto. Se corta aquí: los siguientes son menos relevantes y
    //    tampoco cabrían. No se trunca a mitad de un fragmento (dejaría una
    //    frase mutilada que el modelo podría malinterpretar).
    const cost = chunk.content.length;
    if (charsUsed + cost > charBudget) {
      dropped.overBudget++;
      continue;
    }

    charsUsed += cost;
    selectedTokens.push(tokens);
    documents.push({
      rank: documents.length + 1,
      articleId: chunk.articleId,
      title: chunk.title,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      similarity: chunk.similarity,
    });
  }

  return { documents, dropped, charsUsed };
}

// --- Fuentes ------------------------------------------------------------------

/**
 * Agrupa los documentos por artículo. Un artículo puede aportar varios
 * fragmentos, pero al usuario se le muestra una sola fuente.
 */
function buildSources(documents: ContextDocument[]): ContextSource[] {
  const byArticle = new Map<string, ContextSource>();

  for (const doc of documents) {
    const existing = byArticle.get(doc.articleId);
    if (existing) {
      existing.chunkIndexes.push(doc.chunkIndex);
      // El rank y la similitud son los del mejor fragmento (el primero visto).
      continue;
    }
    byArticle.set(doc.articleId, {
      rank: doc.rank,
      articleId: doc.articleId,
      title: doc.title,
      similarity: doc.similarity,
      chunkIndexes: [doc.chunkIndex],
      url: `/article/${doc.articleId}`,
    });
  }

  return [...byArticle.values()].sort((a, b) => a.rank - b.rank);
}

// --- API ----------------------------------------------------------------------

/**
 * Construye el contexto y el prompt a partir de una consulta y los fragmentos
 * recuperados. Se detiene aquí: no envía nada a ningún modelo.
 */
function buildContext(
  query: string,
  chunks: RetrievedChunk[],
  options?: ContextBuilderOptions,
): BuiltContext {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("La consulta no puede estar vacía.");

  const resolved = resolveOptions(options);
  const { documents, dropped, charsUsed } = selectDocuments(chunks, resolved);
  const sources = buildSources(documents);

  return {
    query: trimmed,
    hasContext: documents.length > 0,
    documents,
    sources,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(trimmed, documents),
    stats: {
      chunksRetrieved: chunks.length,
      chunksSelected: documents.length,
      charBudget: resolved.tokenBudget * CHARS_PER_TOKEN,
      charsUsed,
      dropped,
    },
  };
}

export const contextBuilderService = {
  buildContext,
  // Expuestas para reutilización y verificación; son funciones puras.
  selectDocuments,
  buildSources,
};
