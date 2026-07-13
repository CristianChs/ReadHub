// Contratos del motor de recuperación semántica.

/** Parámetros de ranking. Todos opcionales: ver defaults en vector-search.service. */
export interface VectorSearchOptions {
  /** Número máximo de fragmentos a recuperar (Top-K). */
  topK?: number;
  /** Similitud coseno mínima [0..1] para considerar un fragmento relevante. */
  threshold?: number;
}

/**
 * Un fragmento recuperado. Contiene todo lo necesario para que la siguiente
 * fase construya el contexto del LLM y cite la fuente:
 *  - `content`   -> el texto que se inyecta en el prompt
 *  - `articleId` -> permite enlazar a /article/{id}
 *  - `title`     -> permite citar la fuente por su nombre
 *  - `similarity`-> permite ordenar, filtrar y recortar el contexto
 */
export interface RetrievedChunk {
  articleId: string;
  title: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

/** Vista agrupada: un artículo relevante con sus fragmentos recuperados. */
export interface RetrievedArticle {
  articleId: string;
  title: string;
  /** Similitud del mejor fragmento del artículo. Define su posición. */
  score: number;
  chunks: RetrievedChunk[];
}

/** Resultado estructurado de una recuperación. */
export interface VectorSearchResult {
  query: string;
  /** Fragmentos ordenados por relevancia descendente. */
  chunks: RetrievedChunk[];
  /** Los mismos fragmentos agrupados por artículo, ordenados por su mejor score. */
  articles: RetrievedArticle[];
  /** Parámetros efectivamente aplicados (útil para depurar y calibrar). */
  applied: Required<VectorSearchOptions>;
}
