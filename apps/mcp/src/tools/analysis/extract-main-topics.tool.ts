import { z } from "zod";

import { READ_ONLY, runTool } from "../shared.js";
import type { ToolRegistrar } from "../shared.js";
import { articleIdsSchema, loadCorpus } from "./shared.js";

/**
 * `extract_main_topics` — temas principales de un conjunto de artículos.
 *
 * Un tema principal es un término frecuente Y transversal: aparece muchas veces
 * y en muchos artículos. Se puntúa combinando frecuencia total y amplitud
 * (nº de documentos), de modo que un término repetido en un solo artículo no se
 * confunde con un tema del conjunto.
 *
 * Si no se dan ids, opera sobre todos los artículos públicos (hasta MAX_CORPUS):
 * es la vista de "de qué trata ReadHub".
 */
export const registerExtractMainTopics: ToolRegistrar = (server, getContext) => {
  server.registerTool(
    "extract_main_topics",
    {
      title: "Extraer temas principales",
      description:
        "Identifica los temas principales de un conjunto de artículos (o de toda la plataforma si no indicas ids). Un tema puntúa alto si es frecuente y aparece en varios artículos. Devuelve los temas con su frecuencia total y en cuántos artículos aparecen.",
      inputSchema: {
        articleIds: articleIdsSchema.max(25).optional(),
        topN: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(15)
          .describe("Nº de temas a devolver."),
      },
      outputSchema: {
        articleCount: z.number(),
        truncated: z.boolean(),
        topics: z.array(
          z.object({
            term: z.string(),
            totalCount: z.number(),
            documentFrequency: z.number(),
            score: z.number(),
          }),
        ),
      },
      annotations: READ_ONLY,
    },
    async ({ articleIds, topN }) =>
      runTool("extract_main_topics", async () => {
        const { articles, truncated } = await loadCorpus(getContext(), articleIds);

        const total = new Map<string, number>();
        const docFreq = new Map<string, number>();
        for (const article of articles) {
          for (const [term, count] of article.tf) {
            total.set(term, (total.get(term) ?? 0) + count);
            docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
          }
        }

        const corpusSize = Math.max(articles.length, 1);
        const topics = [...total.entries()]
          .map(([term, totalCount]) => {
            const documentFrequency = docFreq.get(term) ?? 1;
            // Amplitud (fracción de documentos) por frecuencia: premia lo
            // transversal sin ignorar lo muy repetido.
            const score = (documentFrequency / corpusSize) * totalCount;
            return {
              term,
              totalCount,
              documentFrequency,
              score: Number(score.toFixed(3)),
            };
          })
          .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
          .slice(0, topN);

        const text = topics
          .map((t) => `${t.term} (${t.totalCount}×, ${t.documentFrequency} art.)`)
          .join("\n");

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            articleCount: articles.length,
            truncated,
            topics,
          },
        };
      }),
  );
};
