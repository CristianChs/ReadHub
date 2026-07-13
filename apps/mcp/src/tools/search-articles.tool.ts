import { z } from "zod";

import { READ_ONLY, articleListItemSchema, runTool } from "./shared.js";
import type { ToolRegistrar } from "./shared.js";

/**
 * `search_articles` — búsqueda léxica: coincidencias literales en título o
 * resumen.
 *
 * Convive a propósito con `semantic_search_articles`. Esta encuentra un
 * artículo por su nombre aunque nunca se haya indexado en la base vectorial;
 * la semántica encuentra artículos que hablan de un tema aunque no compartan
 * ni una palabra con la consulta. La descripción se lo explica al modelo para
 * que sepa cuál elegir.
 *
 * Delega en `articleService.search`.
 */
export const registerSearchArticles: ToolRegistrar = (server, getContext) => {
  server.registerTool(
    "search_articles",
    {
      title: "Buscar artículos por texto",
      description:
        "Busca artículos públicos cuyo título o resumen contenga el texto indicado. Es una búsqueda literal: úsala cuando conozcas el nombre o una palabra exacta. Si buscas artículos que traten sobre un tema, usa semantic_search_articles.",
      inputSchema: {
        query: z.string().min(1).describe("Texto a buscar en título y resumen."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe("Número máximo de artículos a devolver."),
      },
      outputSchema: {
        query: z.string(),
        articles: z.array(articleListItemSchema),
        count: z.number(),
      },
      annotations: READ_ONLY,
    },
    async ({ query, limit }) =>
      runTool("search_articles", async () => {
        const { supabase, services } = getContext();
        const articles = await services.article.search(supabase, query, limit);

        const text =
          articles.length === 0
            ? `Ningún artículo público coincide con "${query}".`
            : articles
                .map((a) => `- ${a.title} (id: ${a.id})`)
                .join("\n");

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { query, articles, count: articles.length },
        };
      }),
  );
};
