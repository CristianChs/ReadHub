import { z } from "zod";

import {
  READ_ONLY_EXTERNAL,
  retrievedChunkSchema,
  runTool,
} from "./shared.js";
import type { ToolRegistrar } from "./shared.js";

/**
 * `semantic_search_articles` — recuperación por significado sobre la base
 * vectorial (pgvector + HNSW).
 *
 * Expone `vectorSearchService.search` tal cual: consulta -> embedding ->
 * similitud coseno -> Top-K. Devuelve los fragmentos y también su agrupación
 * por artículo, que es lo que ya calcula el service.
 *
 * Es la Tool de *recuperación*, no de respuesta: entrega el material fundado
 * para que el modelo razone. Si lo que quieres es una respuesta redactada y
 * citada, usa `ask_readhub`.
 *
 * Requiere `VOYAGE_API_KEY` y artículos previamente indexados.
 */
export const registerSemanticSearchArticles: ToolRegistrar = (
  server,
  getContext,
) => {
  server.registerTool(
    "semantic_search_articles",
    {
      title: "Búsqueda semántica de artículos",
      description:
        "Busca en el contenido completo de los artículos indexados por significado, no por palabras exactas. Devuelve los fragmentos más relevantes con su puntuación de similitud. Úsala para encontrar qué dice ReadHub sobre un tema. Si no devuelve nada, el tema no está cubierto o los artículos aún no se han indexado.",
      inputSchema: {
        query: z.string().min(1).describe("Consulta en lenguaje natural."),
        topK: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Número de fragmentos a recuperar. Por defecto 5."),
        threshold: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe(
            "Similitud coseno mínima [0..1] para considerar relevante un fragmento. Por defecto 0.4.",
          ),
      },
      outputSchema: {
        query: z.string(),
        chunks: z.array(retrievedChunkSchema),
        articles: z.array(
          z.object({
            articleId: z.string(),
            title: z.string(),
            score: z.number(),
            chunks: z.array(retrievedChunkSchema),
          }),
        ),
        applied: z.object({ topK: z.number(), threshold: z.number() }),
      },
      annotations: READ_ONLY_EXTERNAL,
    },
    async ({ query, topK, threshold }) =>
      runTool("semantic_search_articles", async () => {
        const { supabase, rag } = getContext();
        const result = await rag.vectorSearch.search(supabase, query, {
          topK,
          threshold,
        });

        const text =
          result.chunks.length === 0
            ? `Ningún fragmento supera el umbral de similitud ${result.applied.threshold} para "${query}".`
            : result.articles
                .map(
                  (a) =>
                    `[${a.score.toFixed(3)}] ${a.title} (id: ${a.articleId}, ${a.chunks.length} fragmento(s))`,
                )
                .join("\n");

        return {
          content: [{ type: "text" as const, text }],
          // Se copia en un literal: `structuredContent` exige un tipo con index
          // signature, y una `interface` (VectorSearchResult) no la tiene.
          structuredContent: { ...result },
        };
      }),
  );
};
