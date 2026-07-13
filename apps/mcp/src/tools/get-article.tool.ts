import { z } from "zod";

import type { ReadHubContext } from "../context.js";
import { READ_ONLY, articleListItemSchema, runTool } from "./shared.js";
import type { ToolRegistrar } from "./shared.js";

/**
 * Nombre del autor, si este servidor tiene permiso para leerlo.
 *
 * La vista `author_profiles` solo concede SELECT al rol `authenticated`, y el
 * servidor MCP se conecta con la anon key y sin sesión (a propósito: así queda
 * sujeto a las mismas RLS que la web). Sin sesión, Postgres responde 42501.
 *
 * El nombre es metadato decorativo; el artículo es la carga útil. Tumbar la Tool
 * entera por no poder leerlo sería desproporcionado, así que se degrada a `null`.
 * Cualquier otro fallo sí se propaga: solo se absorbe la denegación de permisos.
 */
async function resolveAuthorName(
  services: ReadHubContext["services"],
  supabase: ReadHubContext["supabase"],
  authorId: string,
): Promise<string | null> {
  try {
    const names = await services.auth.getAuthorNames(supabase, [authorId]);
    return names[authorId] ?? null;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "42501") return null;
    throw error;
  }
}

/**
 * `get_article` — un artículo concreto por su identificador.
 *
 * Resuelve además el nombre del autor con `authService.getAuthorNames`, porque
 * el artículo solo guarda un `authorId` y ese UUID no le dice nada al modelo.
 *
 * "No encontrado" NO es un error: es un resultado legítimo (`found: false`).
 * Devolverlo como error obligaría al modelo a interpretar un fallo cuando la
 * respuesta correcta es simplemente que ese artículo no existe o no es público.
 */
export const registerGetArticle: ToolRegistrar = (server, getContext) => {
  server.registerTool(
    "get_article",
    {
      title: "Obtener artículo por id",
      description:
        "Devuelve un artículo de ReadHub a partir de su id, con el nombre de su autor cuando sea legible. Si el artículo no existe o no es público, devuelve found: false. Obtén el id con list_articles o search_articles.",
      inputSchema: {
        id: z.string().uuid().describe("Identificador UUID del artículo."),
      },
      outputSchema: {
        found: z.boolean(),
        article: articleListItemSchema
          .extend({
            documentPath: z.string().nullable(),
            isPublic: z.boolean(),
            authorName: z.string().nullable(),
          })
          .nullable(),
      },
      annotations: READ_ONLY,
    },
    async ({ id }) =>
      runTool("get_article", async () => {
        const { supabase, services } = getContext();
        const article = await services.article.getById(supabase, id);

        if (!article) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No existe ningún artículo público con id ${id}.`,
              },
            ],
            structuredContent: { found: false, article: null },
          };
        }

        const authorName = await resolveAuthorName(services, supabase, article.authorId);

        const text = [
          `Título: ${article.title}`,
          `Autor: ${authorName ?? "desconocido"}`,
          `Publicado: ${article.createdAt}`,
          `Vistas: ${article.views} · Me gusta: ${article.likes}`,
          article.summary ? `\nResumen: ${article.summary}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { found: true, article: { ...article, authorName } },
        };
      }),
  );
};
