import { cosineSimilarity } from "@readhub/shared";
import { z } from "zod";

import { READ_ONLY, runTool } from "../shared.js";
import type { ToolRegistrar } from "../shared.js";
import { articleIdsSchema, loadArticles } from "./shared.js";

/**
 * `compare_multiple_articles` — matriz de similitud léxica entre 2..8 artículos.
 *
 * Extiende el Prompt `compare_articles` (que compara DOS y produce prosa) a un
 * conjunto y a datos estructurados: la similitud coseno de cada par, el par más
 * y menos parecido y la media. Con esos números, el LLM que llama razona la
 * comparación en vez de estimarla a ojo.
 */
export const registerCompareMultipleArticles: ToolRegistrar = (
  server,
  getContext,
) => {
  server.registerTool(
    "compare_multiple_articles",
    {
      title: "Comparar varios artículos",
      description:
        "Calcula la similitud léxica entre 2 y 8 artículos y devuelve la matriz de similitud por pares, el par más y menos parecido y la media. Úsala para situar varios artículos entre sí antes de compararlos en detalle. La similitud mide solapamiento de vocabulario (0 = sin términos en común, 1 = idénticos).",
      inputSchema: {
        articleIds: articleIdsSchema.min(2).max(8),
      },
      outputSchema: {
        articles: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            wordCount: z.number(),
            hasText: z.boolean(),
          }),
        ),
        pairs: z.array(
          z.object({
            a: z.string(),
            b: z.string(),
            titleA: z.string(),
            titleB: z.string(),
            similarity: z.number(),
          }),
        ),
        mostSimilar: z
          .object({ a: z.string(), b: z.string(), similarity: z.number() })
          .nullable(),
        leastSimilar: z
          .object({ a: z.string(), b: z.string(), similarity: z.number() })
          .nullable(),
        averageSimilarity: z.number(),
      },
      annotations: READ_ONLY,
    },
    async ({ articleIds }) =>
      runTool("compare_multiple_articles", async () => {
        const articles = await loadArticles(getContext(), articleIds);

        const pairs = [];
        for (let i = 0; i < articles.length; i++) {
          for (let j = i + 1; j < articles.length; j++) {
            const a = articles[i];
            const b = articles[j];
            pairs.push({
              a: a.id,
              b: b.id,
              titleA: a.title,
              titleB: b.title,
              similarity: Number(cosineSimilarity(a.tf, b.tf).toFixed(4)),
            });
          }
        }

        const sorted = [...pairs].sort((x, y) => y.similarity - x.similarity);
        const average =
          pairs.length === 0
            ? 0
            : Number(
                (
                  pairs.reduce((sum, p) => sum + p.similarity, 0) / pairs.length
                ).toFixed(4),
              );

        const text = sorted
          .map(
            (p) =>
              `${p.similarity.toFixed(3)}  ${p.titleA}  ↔  ${p.titleB}`,
          )
          .join("\n");

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            articles: articles.map((a) => ({
              id: a.id,
              title: a.title,
              wordCount: a.wordCount,
              hasText: a.hasText,
            })),
            pairs,
            mostSimilar: sorted[0]
              ? { a: sorted[0].a, b: sorted[0].b, similarity: sorted[0].similarity }
              : null,
            leastSimilar: sorted.at(-1)
              ? {
                  a: sorted.at(-1)!.a,
                  b: sorted.at(-1)!.b,
                  similarity: sorted.at(-1)!.similarity,
                }
              : null,
            averageSimilarity: average,
          },
        };
      }),
  );
};
