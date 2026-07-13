// Contratos del contexto RAG y de las fuentes citables.

/** Un fragmento seleccionado para entrar en el contexto del LLM. */
export interface ContextDocument {
  /** Posición en el ranking (1-based). Es el número de cita: [1], [2], ... */
  rank: number;
  articleId: string;
  title: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

/**
 * Una fuente citable, agrupada por artículo.
 * Es lo que la interfaz mostrará bajo la respuesta del asistente.
 */
export interface ContextSource {
  /** Número de cita del mejor fragmento de este artículo. */
  rank: number;
  articleId: string;
  title: string;
  /** Similitud del mejor fragmento del artículo. */
  similarity: number;
  /** Fragmentos de este artículo incluidos en el contexto. */
  chunkIndexes: number[];
  /** Enlace directo al artículo dentro de ReadHub. */
  url: string;
}

/** Motivos por los que un fragmento recuperado puede quedar fuera del contexto. */
export interface ContextDropStats {
  belowThreshold: number;
  lowQuality: number;
  redundant: number;
  overMaxDocuments: number;
  overBudget: number;
}

/** Trazabilidad de la construcción: útil para depurar y calibrar. */
export interface ContextStats {
  chunksRetrieved: number;
  chunksSelected: number;
  charBudget: number;
  charsUsed: number;
  dropped: ContextDropStats;
}

/** Resultado del Context Builder: todo lo necesario para la siguiente fase. */
export interface BuiltContext {
  query: string;
  /** false cuando no hay ningún documento relevante. */
  hasContext: boolean;
  documents: ContextDocument[];
  sources: ContextSource[];
  /** Instrucciones del sistema, listas para el LLM. */
  systemPrompt: string;
  /** Turno del usuario: contexto + pregunta. Listo para el LLM. */
  userPrompt: string;
  stats: ContextStats;
}

/** Parámetros de construcción. Todos opcionales; ver defaults en el service. */
export interface ContextBuilderOptions {
  /** Similitud mínima para considerar un fragmento. */
  minSimilarity?: number;
  /** Nº máximo de fragmentos en el contexto. */
  maxDocuments?: number;
  /** Presupuesto de tokens del contexto (se traduce a caracteres). */
  tokenBudget?: number;
  /** Solape léxico [0..1] por encima del cual dos fragmentos se consideran redundantes. */
  redundancyThreshold?: number;
}

// --- Servicio conversacional --------------------------------------------------

/** Metadatos del proceso RAG. Trazabilidad y datos para la interfaz. */
export interface ChatMetadata {
  /** Modelo que respondió, o null si no se invocó al LLM. */
  model: string | null;
  /** false cuando se cortocircuitó por ausencia de contexto. */
  llmInvoked: boolean;
  chunksRetrieved: number;
  chunksUsed: number;
  charBudget: number;
  charsUsed: number;
  dropped: ContextDropStats;
  usage: { inputTokens: number; outputTokens: number } | null;
  latencyMs: number;
}

/** Resultado estructurado de una consulta al asistente. */
export interface ChatResponse {
  query: string;
  /** Respuesta generada, fundamentada exclusivamente en `sources`. */
  answer: string;
  /** false => el asistente respondió que no tiene información. */
  hasContext: boolean;
  /** Artículos usados como contexto, con su puntuación y su enlace. */
  sources: ContextSource[];
  metadata: ChatMetadata;
}

/**
 * Eventos del flujo RAG en streaming.
 *
 * `meta` llega SIEMPRE primero: la interfaz puede pintar las fuentes antes de
 * que el modelo escriba una sola palabra.
 */
export type ChatStreamEvent =
  | { type: "meta"; query: string; hasContext: boolean; sources: ContextSource[] }
  | { type: "delta"; text: string }
  | { type: "done"; metadata: ChatMetadata }
  | { type: "error"; message: string };

/** Parámetros de la consulta. Se delegan a los services correspondientes. */
export interface ChatOptions {
  /** Parámetros del motor de recuperación (topK, threshold). */
  retrieval?: import("./vector-search").VectorSearchOptions;
  /** Parámetros del constructor de contexto. */
  context?: ContextBuilderOptions;
  /** Techo de tokens de la respuesta del modelo. */
  maxTokens?: number;
}
