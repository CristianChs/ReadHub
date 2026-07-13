import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { aggregateByAuthor, jsonContents, uri } from "./shared.js";
import type { ResourceRegistrar } from "./shared.js";

/**
 * Resources de autores.
 *
 *   readhub://authors       -> colección: quién ha publicado, con su actividad.
 *   readhub://authors/{id}  -> un autor concreto y sus artículos.
 *
 * ReadHub no tiene tabla de autores: un autor es un perfil con artículos
 * públicos. Por eso la lista se DERIVA de `articleService.list` (agrupando por
 * `authorId`) y los nombres se resuelven con `authService.getAuthorNames`. No
 * hay consulta nueva ni lógica duplicada: solo composición de dos services.
 *
 * Los nombres dependen del permiso de lectura de `author_profiles`; si no es
 * legible, `name` queda null en lugar de romper el recurso.
 */
export const registerAuthorResources: ResourceRegistrar = (
  server,
  getContext,
) => {
  server.registerResource(
    "authors",
    uri.authors,
    {
      title: "Autores de ReadHub",
      description:
        "Colección de autores con artículos públicos, con su número de artículos y sus vistas y me gusta acumulados.",
      mimeType: "application/json",
    },
    async (resourceUri) => {
      const { supabase, services } = getContext();
      const articles = await services.article.list(supabase);
      const aggregates = aggregateByAuthor(articles);
      const names = await services.auth.getAuthorNames(
        supabase,
        aggregates.map((a) => a.authorId),
      );

      return jsonContents(resourceUri.href, {
        count: aggregates.length,
        authors: aggregates.map((a) => ({
          authorId: a.authorId,
          name: names[a.authorId] ?? null,
          articleCount: a.articleCount,
          totalViews: a.totalViews,
          totalLikes: a.totalLikes,
        })),
      });
    },
  );

  server.registerResource(
    "author",
    new ResourceTemplate(`${uri.authors}/{id}`, {
      list: async () => {
        const { supabase, services } = getContext();
        const articles = await services.article.list(supabase);
        const aggregates = aggregateByAuthor(articles);
        const names = await services.auth.getAuthorNames(
          supabase,
          aggregates.map((a) => a.authorId),
        );
        return {
          resources: aggregates.map((a) => ({
            uri: uri.author(a.authorId),
            name: names[a.authorId] ?? `Autor ${a.authorId.slice(0, 8)}`,
            description: `${a.articleCount} artículo(s) público(s).`,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      title: "Autor por id",
      description: "Un autor concreto y la lista de sus artículos públicos.",
      mimeType: "application/json",
    },
    async (resourceUri, variables) => {
      const authorId = String(variables.id);
      const { supabase, services } = getContext();

      const articles = await services.article.list(supabase);
      const own = articles.filter((a) => a.authorId === authorId);
      if (own.length === 0) {
        throw new Error(
          `No hay ningún autor con artículos públicos e id ${authorId}.`,
        );
      }

      const names = await services.auth.getAuthorNames(supabase, [authorId]);

      return jsonContents(resourceUri.href, {
        authorId,
        name: names[authorId] ?? null,
        articleCount: own.length,
        totalViews: own.reduce((sum, a) => sum + a.views, 0),
        totalLikes: own.reduce((sum, a) => sum + a.likes, 0),
        articles: own,
      });
    },
  );
};
