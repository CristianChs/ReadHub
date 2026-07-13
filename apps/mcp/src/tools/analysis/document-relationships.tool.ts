import { cosineSimilarity, documentFrequencies } from "@readhub/shared";
import { z } from "zod";

import { READ_ONLY, runTool } from "../shared.js";
import type { ToolRegistrar } from "../shared.js";
import { articleIdsSchema, loadCorpus } from "./shared.js";

/**
 * `map_document_relationships` — grafo de relaciones entre artículos.
 *
 * Nodos = artículos; aristas = pares cuya similitud léxica supera un umbral,
 * etiquetadas con los términos que los conectan. Revela grupos temáticos y
 * artículos aislados dentro del corpus. Es la vista de conjunto que
 * `compare_multiple_articles` (pares sueltos) no da.
 *
 * Sin ids, opera sobre todos los artículos públicos (hasta MAX_CORPUS).
 */
export const registerDocumentRelationships: ToolRegistrar = (
  server,
  getContext,
) => {
  server.registerTool(
    "map_document_relationships",
    {
      title: "Mapa de relaciones entre documentos",
      description:
        "Construye un grafo de relaciones entre artículos por su similitud léxica: cada arista une dos artículos relacionados y lista los términos que los conectan. Identifica también los artículos aislados. Úsala para descubrir grupos temáticos en la plataforma. Sin ids, analiza todos los artículos públicos.",
      inputSchema: {
        articleIds: articleIdsSchema.max(25).optional(),
        threshold: z
          .number()
          .min(0)
          .max(1)
          .default(0.1)
          .describe("Similitud mínima [0..1] para considerar relacionados dos artículos."),
      },
      outputSchema: {
        nodes: z.array(z.object({ id: z.string(), title: z.string() })),
        edges: z.array(
          z.object({
            a: z.string(),
            b: z.string(),
            similarity: z.number(),
            connectingTerms: z.array(z.string()),
          }),
        ),
        isolated: z.array(z.string()),
        threshold: z.number(),
        truncated: z.boolean(),
      },
      annotations: READ_ONLY,
    },
    async ({ articleIds, threshold }) =>
      runTool("map_document_relationships", async () => {
        const { articles, truncated } = await loadCorpus(getContext(), articleIds);
        const df = documentFrequencies(articles.map((a) => a.tf));

        const edges = [];
        const connected = new Set<string>();
        for (let i = 0; i < articles.length; i++) {
          for (let j = i + 1; j < articles.length; j++) {
            const a = articles[i];
            const b = articles[j];
            const similarity = cosineSimilarity(a.tf, b.tf);
            if (similarity < threshold) continue;

            // Términos que conectan: compartidos, poco comunes en el corpus
            // (menos genéricos), ordenados por su peso combinado en ambos.
            const connectingTerms = [...a.tf.keys()]
              .filter((term) => b.tf.has(term))
              .sort(
                (t1, t2) =>
                  (a.tf.get(t2)! + b.tf.get(t2)!) / (df.get(t2) ?? 1) -
                  (a.tf.get(t1)! + b.tf.get(t1)!) / (df.get(t1) ?? 1),
              )
              .slice(0, 6);

            edges.push({
              a: a.id,
              b: b.id,
              similarity: Number(similarity.toFixed(4)),
              connectingTerms,
            });
            connected.add(a.id);
            connected.add(b.id);
          }
        }

        const isolated = articles
          .filter((a) => !connected.has(a.id))
          .map((a) => a.id);

        const titleOf = new Map(articles.map((a) => [a.id, a.title]));
        const text =
          edges.length === 0
            ? "Ningún par supera el umbral: no se detectaron relaciones."
            : edges
                .sort((x, y) => y.similarity - x.similarity)
                .map(
                  (e) =>
                    `${e.similarity.toFixed(3)}  ${titleOf.get(e.a)} ↔ ${titleOf.get(e.b)}  [${e.connectingTerms.join(", ")}]`,
                )
                .join("\n");

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            nodes: articles.map((a) => ({ id: a.id, title: a.title })),
            edges,
            isolated,
            threshold,
            truncated,
          },
        };
      }),
  );
};
