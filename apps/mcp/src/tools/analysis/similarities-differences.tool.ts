import {
  documentFrequencies,
  tfidfKeywords,
  topTerms,
} from "@readhub/shared";
import { z } from "zod";

import { READ_ONLY, runTool } from "../shared.js";
import type { ToolRegistrar } from "../shared.js";
import { articleIdsSchema, loadArticles } from "./shared.js";

/**
 * `find_similarities_and_differences` — desglose léxico de un conjunto.
 *
 * Donde `compare_multiple_articles` da un número por par, esta Tool lo abre en
 * términos: qué vocabulario COMPARTEN los artículos (temas comunes) y qué tiene
 * cada uno de DISTINTIVO (por TF-IDF frente al resto del conjunto). Es el "en
 * qué se parecen y en qué se diferencian" a nivel de contenido.
 */
export const registerSimilaritiesDifferences: ToolRegistrar = (
  server,
  getContext,
) => {
  server.registerTool(
    "find_similarities_and_differences",
    {
      title: "Similitudes y diferencias",
      description:
        "Analiza un conjunto de 2 a 8 artículos y devuelve los términos que comparten (puntos en común) y los términos distintivos de cada uno (lo que lo diferencia del resto). Complementa a compare_multiple_articles: en lugar de una puntuación por par, da el detalle léxico de qué los une y qué los separa.",
      inputSchema: {
        articleIds: articleIdsSchema.min(2).max(8),
        termCount: z
          .number()
          .int()
          .min(1)
          .max(30)
          .default(10)
          .describe("Nº de términos por sección."),
      },
      outputSchema: {
        sharedTerms: z.array(
          z.object({ term: z.string(), presentIn: z.number() }),
        ),
        perArticle: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            distinctiveTerms: z.array(
              z.object({ term: z.string(), score: z.number() }),
            ),
          }),
        ),
      },
      annotations: READ_ONLY,
    },
    async ({ articleIds, termCount }) =>
      runTool("find_similarities_and_differences", async () => {
        const articles = await loadArticles(getContext(), articleIds);
        const vectors = articles.map((a) => a.tf);
        const df = documentFrequencies(vectors);
        const corpusSize = articles.length;

        // Compartidos: presentes en TODOS (o casi), ordenados por cobertura y
        // luego por frecuencia total.
        const shared = [...df.entries()]
          .filter(([, count]) => count >= Math.max(2, corpusSize - 1))
          .map(([term, presentIn]) => ({
            term,
            presentIn,
            total: vectors.reduce((sum, v) => sum + (v.get(term) ?? 0), 0),
          }))
          .sort((a, b) => b.presentIn - a.presentIn || b.total - a.total)
          .slice(0, termCount)
          .map(({ term, presentIn }) => ({ term, presentIn }));

        const perArticle = articles.map((a) => ({
          id: a.id,
          title: a.title,
          distinctiveTerms: tfidfKeywords(a.tf, df, corpusSize, termCount).map(
            (k) => ({ term: k.term, score: Number(k.score.toFixed(3)) }),
          ),
        }));

        const text = [
          `Términos compartidos: ${shared.map((s) => s.term).join(", ") || "(ninguno)"}`,
          "",
          ...perArticle.map(
            (p) =>
              `Distintivo de «${p.title}»: ${p.distinctiveTerms
                .slice(0, 8)
                .map((t) => t.term)
                .join(", ")}`,
          ),
        ].join("\n");

        // Fallback si el corpus no comparte casi nada (dos textos dispares):
        // se muestran los términos de mayor frecuencia de documento.
        const sharedTerms =
          shared.length > 0
            ? shared
            : topTerms(df, termCount).map((t) => ({
                term: t.term,
                presentIn: t.count,
              }));

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { sharedTerms, perArticle },
        };
      }),
  );
};
