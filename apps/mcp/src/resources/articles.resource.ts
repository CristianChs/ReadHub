import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { jsonContents, uri } from "./shared.js";
import type { ResourceRegistrar } from "./shared.js";

/**
 * Resources de artículos.
 *
 *   readhub://articles       -> colección: todos los artículos públicos.
 *   readhub://articles/{id}  -> uno concreto, con el nombre de su autor.
 *
 * La plantilla es navegable: su callback `list` enumera cada artículo como un
 * recurso propio, de modo que un cliente MCP puede recorrerlos sin conocer los
 * id de antemano.
 *
 * Ambos delegan en `articleService`; ninguno consulta Supabase directamente.
 */
export const registerArticleResources: ResourceRegistrar = (
  server,
  getContext,
) => {
  server.registerResource(
    "articles",
    uri.articles,
    {
      title: "Artículos de ReadHub",
      description:
        "Colección de todos los artículos públicos, del más reciente al más antiguo.",
      mimeType: "application/json",
    },
    async (resourceUri) => {
      const { supabase, services } = getContext();
      const articles = await services.article.list(supabase);
      return jsonContents(resourceUri.href, {
        count: articles.length,
        articles,
      });
    },
  );

  server.registerResource(
    "article",
    new ResourceTemplate(`${uri.articles}/{id}`, {
      list: async () => {
        const { supabase, services } = getContext();
        const articles = await services.article.list(supabase);
        return {
          resources: articles.map((a) => ({
            uri: uri.article(a.id),
            name: a.title,
            description: a.summary ?? undefined,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      title: "Artículo por id",
      description:
        "Un artículo concreto de ReadHub identificado por su UUID, con el nombre de su autor si es legible.",
      mimeType: "application/json",
    },
    async (resourceUri, variables) => {
      const id = String(variables.id);
      const { supabase, services } = getContext();

      const article = await services.article.getById(supabase, id);
      if (!article) {
        throw new Error(`No existe ningún artículo público con id ${id}.`);
      }

      const names = await services.auth.getAuthorNames(supabase, [
        article.authorId,
      ]);

      return jsonContents(resourceUri.href, {
        ...article,
        authorName: names[article.authorId] ?? null,
      });
    },
  );
};
