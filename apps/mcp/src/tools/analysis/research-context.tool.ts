import {
  cosineSimilarity,
  termFrequencies,
  tokenize,
  topTerms,
} from "@readhub/shared";
import { z } from "zod";

import type { ReadHubContext } from "../../context.js";
import { READ_ONLY_EXTERNAL, runTool } from "../shared.js";
import type { ToolRegistrar } from "../shared.js";
import { loadCorpus } from "./shared.js";

const MAX_EXCERPT = 1500;

interface Source {
  articleId: string;
  title: string;
  relevance: number;
  excerpt: string;
}

/**
 * `build_research_context` — dosier de investigación sobre un tema.
 *
 * Reúne el material más relevante de ReadHub para una pregunta de investigación
 * y lo entrega estructurado y citado, listo para que un LLM investigue sobre él.
 *
 * APROVECHA LA BÚSQUEDA SEMÁNTICA: primero intenta `vectorSearchService.search`
 * (embeddings). Si no hay embeddings ni clave de Voyage, DEGRADA a una selección
 * léxica (coseno sobre frecuencias de término) para seguir siendo útil sin
 * proveedor externo. El campo `method` indica cuál se usó.
 *
 * Complementa a `ask_readhub` (que responde) devolviendo el CONTEXTO en bruto:
 * el modelo del cliente conduce la investigación con estas fuentes.
 */
export const registerResearchContext: ToolRegistrar = (server, getContext) => {
  server.registerTool(
    "build_research_context",
    {
      title: "Construir contexto de investigación",
      description:
        "Reúne el material más relevante de ReadHub para un tema de investigación y lo devuelve estructurado con sus fuentes. Usa búsqueda semántica si hay embeddings disponibles; si no, recurre a una selección léxica. Devuelve las fuentes, un extracto de cada una y los temas del contexto, para que investigues sobre ese material.",
      inputSchema: {
        query: z.string().min(1).describe("Tema o pregunta de investigación."),
        maxArticles: z
          .number()
          .int()
          .min(1)
          .max(15)
          .default(5)
          .describe("Nº máximo de fuentes a reunir."),
      },
      outputSchema: {
        query: z.string(),
        method: z.enum(["semantic", "lexical"]),
        sources: z.array(
          z.object({
            articleId: z.string(),
            title: z.string(),
            relevance: z.number(),
            excerpt: z.string(),
          }),
        ),
        topics: z.array(z.string()),
      },
      annotations: READ_ONLY_EXTERNAL,
    },
    async ({ query, maxArticles }) =>
      runTool("build_research_context", async () => {
        const ctx = getContext();
        const { sources, method } = await gatherSources(ctx, query, maxArticles);

        // Temas del dosier: términos frecuentes en los extractos reunidos.
        const combined = termFrequencies(
          tokenize(sources.map((s) => s.excerpt).join("\n")),
        );
        const topics = topTerms(combined, 12).map((t) => t.term);

        const text = [
          `Contexto de investigación para: "${query}" (método: ${method}).`,
          sources.length
            ? "Investiga usando ÚNICAMENTE las fuentes siguientes; cítalas por su título."
            : "No se encontró material relevante en ReadHub para este tema.",
          "",
          ...sources.map(
            (s, i) =>
              `### Fuente ${i + 1}: ${s.title} (relevancia ${s.relevance.toFixed(3)})\n${s.excerpt}`,
          ),
        ].join("\n");

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { query, method, sources, topics },
        };
      }),
  );
};

/**
 * Reúne las fuentes. Intenta semántica; degrada a léxica ante cualquier fallo
 * (falta de clave, sin embeddings) o si la semántica no devuelve nada.
 */
async function gatherSources(
  ctx: ReadHubContext,
  query: string,
  maxArticles: number,
): Promise<{ sources: Source[]; method: "semantic" | "lexical" }> {
  const { supabase, rag } = ctx;

  try {
    const result = await rag.vectorSearch.search(supabase, query, {
      topK: maxArticles * 3,
    });
    if (result.articles.length > 0) {
      const sources: Source[] = result.articles
        .slice(0, maxArticles)
        .map((article) => ({
          articleId: article.articleId,
          title: article.title,
          relevance: Number(article.score.toFixed(4)),
          excerpt: article.chunks
            .map((c) => c.content)
            .join("\n")
            .slice(0, MAX_EXCERPT),
        }));
      return { sources, method: "semantic" };
    }
  } catch {
    // Sin embeddings ni clave de Voyage: se cae a la vía léxica.
  }

  const queryTf = termFrequencies(tokenize(query));
  const { articles } = await loadCorpus(ctx);
  const sources: Source[] = articles
    .map((a) => ({
      articleId: a.id,
      title: a.title,
      relevance: Number(cosineSimilarity(queryTf, a.tf).toFixed(4)),
      excerpt: (a.text ?? a.summary ?? "").slice(0, MAX_EXCERPT),
    }))
    .filter((s) => s.relevance > 0)
    .sort((x, y) => y.relevance - x.relevance)
    .slice(0, maxArticles);

  return { sources, method: "lexical" };
}
