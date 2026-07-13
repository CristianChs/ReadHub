import { aggregateByAuthor, jsonContents, totalsFrom, uri } from "./shared.js";
import type { ResourceRegistrar } from "./shared.js";

/**
 * `readhub://stats` — estadísticas agregadas de la plataforma.
 *
 * Totales (artículos, autores, vistas, me gusta), reparto por categoría y los
 * artículos y autores más destacados. Todo se deriva de `articleService.list` y
 * `categoryService.listWithCounts`: sin consultas propias, sin duplicar conteos.
 */
export const registerStatsResource: ResourceRegistrar = (server, getContext) => {
  server.registerResource(
    "stats",
    uri.stats,
    {
      title: "Estadísticas de ReadHub",
      description:
        "Métricas agregadas de la plataforma: totales, reparto por categoría y contenido más destacado.",
      mimeType: "application/json",
    },
    async (resourceUri) => {
      const { supabase, services } = getContext();
      const [articles, categories] = await Promise.all([
        services.article.list(supabase),
        services.category.listWithCounts(supabase),
      ]);

      const totals = totalsFrom(articles);
      const authors = aggregateByAuthor(articles);
      const names = await services.auth.getAuthorNames(
        supabase,
        authors.map((a) => a.authorId),
      );

      const topArticles = [...articles]
        .sort((a, b) => b.views - a.views)
        .slice(0, 5)
        .map((a) => ({ id: a.id, title: a.title, views: a.views, likes: a.likes }));

      return jsonContents(resourceUri.href, {
        totals: {
          articles: totals.articles,
          authors: totals.authors,
          categories: categories.length,
          views: totals.views,
          likes: totals.likes,
        },
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          articleCount: c.articleCount,
        })),
        topArticlesByViews: topArticles,
        topAuthorsByArticles: authors.slice(0, 5).map((a) => ({
          authorId: a.authorId,
          name: names[a.authorId] ?? null,
          articleCount: a.articleCount,
          totalViews: a.totalViews,
          totalLikes: a.totalLikes,
        })),
      });
    },
  );
};
