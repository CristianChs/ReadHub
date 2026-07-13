// Contratos del sistema de embeddings (capa de aplicación, camelCase).
// Deliberadamente agnósticos del proveedor: ningún módulo fuera de
// lib/ai/embeddings.ts debe conocer a Voyage AI.

/** Un embedding es un vector denso de números en coma flotante. */
export type Embedding = number[];

/**
 * Voyage distingue el propósito del texto al vectorizarlo: un documento a
 * indexar y una consulta de búsqueda se proyectan de forma distinta en el
 * espacio vectorial. Usar el valor correcto mejora la calidad de recuperación.
 */
export type EmbeddingInputType = "document" | "query";

/** Datos del artículo necesarios para componer el texto a vectorizar. */
export interface ArticleEmbeddingInput {
  articleId: string;
  title: string;
  summary?: string | null;
  /** Texto completo del documento. Si falta, se vectoriza solo título+resumen. */
  content?: string | null;
}

/** Resultado de vectorizar y persistir un artículo. */
export interface EmbedArticleResult {
  articleId: string;
  /** Número de fragmentos generados y almacenados. */
  chunks: number;
  model: string;
  dimensions: number;
}
