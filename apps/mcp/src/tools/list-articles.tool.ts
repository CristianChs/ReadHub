import { z } from "zod";

import { READ_ONLY, articleListItemSchema, runTool } from "./shared.js";
import type { ToolRegistrar } from "./shared.js";

/**
 * `list_articles` — catálogo de artículos públicos, del más reciente al más
 * antiguo.
 *
 * Es la Tool de entrada: da al modelo una visión del corpus (y los `id` que
 * necesitan `get_article` y el resto) sin obligarle a adivinar una consulta.
 *
 * Delega íntegramente en `articleService.list`. El `limit` solo recorta el
 * resultado para no inundar la ventana de contexto; no es un filtro de negocio.
 */
export const registerListArticles: ToolRegistrar = (server, getContext) => {
  server.registerTool(
    "list_articles",
    {
      title: "Listar artículos",
      description:
        "Devuelve los artículos públicos de ReadHub ordenados del más reciente al más antiguo, con su autor, resumen y contadores de vistas y me gusta. Úsala para explorar qué contiene la plataforma o para obtener el id de un artículo.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe("Número máximo de artículos a devolver."),
      },
      outputSchema: {
        articles: z.array(articleListItemSchema),
        count: z.number(),
      },
      annotations: READ_ONLY,
    },
    async ({ limit }) =>
      runTool("list_articles", async () => {
        const { supabase, services } = getContext();
        const all = await services.article.list(supabase);
        const articles = all.slice(0, limit);

        const text =
          articles.length === 0
            ? "No hay artículos públicos en ReadHub."
            : articles
                .map(
                  (a) =>
                    `- ${a.title} (id: ${a.id}, ${a.views} vistas, ${a.likes} me gusta)`,
                )
                .join("\n");

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { articles, count: articles.length },
        };
      }),
  );
};
