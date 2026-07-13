import { jsonContents, totalsFrom, uri } from "./shared.js";
import type { ResourceRegistrar } from "./shared.js";

/**
 * `readhub://overview` — información general de ReadHub.
 *
 * Es el punto de entrada: describe qué es la plataforma, da unas cifras rápidas
 * y enumera el resto de Resources disponibles para que un cliente MCP sepa por
 * dónde seguir navegando. Las cifras se derivan de `articleService.list`; el
 * resto es metainformación estática del propio servidor.
 */
const DESCRIPTION =
  "ReadHub es una plataforma de publicación de artículos. Los autores publican documentos (PDF, DOCX o TXT) con una portada y un resumen; los lectores los consultan, comentan y marcan con me gusta. Un asistente basado en RAG responde preguntas fundamentándose exclusivamente en el contenido publicado.";

export const registerOverviewResource: ResourceRegistrar = (
  server,
  getContext,
) => {
  server.registerResource(
    "overview",
    uri.overview,
    {
      title: "ReadHub: información general",
      description:
        "Qué es ReadHub, unas cifras rápidas y el índice de Resources navegables.",
      mimeType: "application/json",
    },
    async (resourceUri) => {
      const { supabase, services } = getContext();
      const articles = await services.article.list(supabase);
      const totals = totalsFrom(articles);

      return jsonContents(resourceUri.href, {
        name: "ReadHub",
        description: DESCRIPTION,
        counts: {
          publicArticles: totals.articles,
          authors: totals.authors,
          totalViews: totals.views,
          totalLikes: totals.likes,
        },
        resources: [
          { uri: uri.overview, description: "Esta información general." },
          { uri: uri.stats, description: "Métricas agregadas de la plataforma." },
          { uri: uri.articles, description: "Todos los artículos públicos." },
          {
            uri: `${uri.articles}/{id}`,
            description: "Un artículo concreto por su id.",
          },
          { uri: uri.authors, description: "Autores con artículos públicos." },
          {
            uri: `${uri.authors}/{id}`,
            description: "Un autor concreto y sus artículos.",
          },
          { uri: uri.categories, description: "Catálogo de categorías temáticas." },
          {
            uri: `${uri.categories}/{slug}`,
            description: "Una categoría concreta y sus artículos.",
          },
        ],
      });
    },
  );
};
