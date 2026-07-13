import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { jsonContents, uri } from "./shared.js";
import type { ResourceRegistrar } from "./shared.js";

/**
 * Resources de categorías.
 *
 *   readhub://categories        -> catálogo, con el nº de artículos por categoría.
 *   readhub://categories/{slug} -> una categoría y sus artículos públicos.
 *
 * El catálogo lo sirve `categoryService`; los artículos de una categoría se
 * obtienen filtrando `articleService.list` por `categoryId`. Ninguna consulta
 * nueva vive aquí.
 */
export const registerCategoryResources: ResourceRegistrar = (
  server,
  getContext,
) => {
  server.registerResource(
    "categories",
    uri.categories,
    {
      title: "Categorías de ReadHub",
      description:
        "Catálogo de categorías temáticas, con el número de artículos públicos de cada una.",
      mimeType: "application/json",
    },
    async (resourceUri) => {
      const { supabase, services } = getContext();
      const categories = await services.category.listWithCounts(supabase);
      return jsonContents(resourceUri.href, {
        count: categories.length,
        categories,
      });
    },
  );

  server.registerResource(
    "category",
    new ResourceTemplate(`${uri.categories}/{slug}`, {
      list: async () => {
        const { supabase, services } = getContext();
        const categories = await services.category.listWithCounts(supabase);
        return {
          resources: categories.map((c) => ({
            uri: uri.category(c.slug),
            name: c.name,
            description: c.description ?? `${c.articleCount} artículo(s).`,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      title: "Categoría por slug",
      description:
        "Una categoría concreta identificada por su slug, con sus artículos públicos.",
      mimeType: "application/json",
    },
    async (resourceUri, variables) => {
      const slug = String(variables.slug);
      const { supabase, services } = getContext();

      const categories = await services.category.list(supabase);
      const category = categories.find((c) => c.slug === slug);
      if (!category) {
        throw new Error(`No existe ninguna categoría con slug "${slug}".`);
      }

      const articles = await services.article.list(supabase);
      const own = articles.filter((a) => a.categoryId === category.id);

      return jsonContents(resourceUri.href, {
        ...category,
        articleCount: own.length,
        articles: own,
      });
    },
  );
};
