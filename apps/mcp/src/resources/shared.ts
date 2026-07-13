import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ArticleListItem } from "@readhub/types";

import type { ContextFactory } from "../context.js";

// ============================================================================
// Piezas comunes a todos los Resources.
//
// Aquí NO hay consultas ni lógica de negocio: solo el contrato de registro, la
// construcción de la respuesta del protocolo y agregaciones de presentación
// sobre objetos de dominio ya recuperados por los services.
// ============================================================================

/**
 * Contrato de un registrador de Resources. Cada fichero de `resources/` exporta
 * uno y el índice los ejecuta en bucle: añadir un Resource es añadir un fichero
 * y una entrada al array, sin tocar el servidor.
 */
export interface ResourceRegistrar {
  (server: McpServer, getContext: ContextFactory): void;
}

/** Esquema de URIs de ReadHub. Un único sitio donde se define el prefijo. */
export const SCHEME = "readhub";

export const uri = {
  overview: `${SCHEME}://overview`,
  stats: `${SCHEME}://stats`,
  articles: `${SCHEME}://articles`,
  article: (id: string) => `${SCHEME}://articles/${id}`,
  authors: `${SCHEME}://authors`,
  author: (id: string) => `${SCHEME}://authors/${id}`,
  categories: `${SCHEME}://categories`,
  category: (slug: string) => `${SCHEME}://categories/${slug}`,
} as const;

/**
 * Empaqueta cualquier valor serializable como contenido JSON de un Resource.
 *
 * Todos los Resources hablan `application/json`: son datos estructurados para
 * que un cliente los consuma, no prosa para leer.
 */
export function jsonContents(resourceUri: string, data: unknown) {
  return {
    contents: [
      {
        uri: resourceUri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

// --- Agregaciones de presentación -------------------------------------------
// Operan sobre lo que ya devolvió `articleService.list`. No consultan la base
// de datos: solo reorganizan. Se comparten entre los Resources de autores,
// estadísticas y visión general para no repetir el mismo recuento.

export interface AuthorAggregate {
  authorId: string;
  articleCount: number;
  totalViews: number;
  totalLikes: number;
  articleIds: string[];
}

/** Agrupa artículos por autor, del que más artículos tiene al que menos. */
export function aggregateByAuthor(
  articles: ArticleListItem[],
): AuthorAggregate[] {
  const byAuthor = new Map<string, AuthorAggregate>();

  for (const article of articles) {
    const current =
      byAuthor.get(article.authorId) ??
      ({
        authorId: article.authorId,
        articleCount: 0,
        totalViews: 0,
        totalLikes: 0,
        articleIds: [],
      } satisfies AuthorAggregate);

    current.articleCount += 1;
    current.totalViews += article.views;
    current.totalLikes += article.likes;
    current.articleIds.push(article.id);
    byAuthor.set(article.authorId, current);
  }

  return [...byAuthor.values()].sort(
    (a, b) => b.articleCount - a.articleCount,
  );
}

/** Totales de plataforma derivados del listado público. */
export function totalsFrom(articles: ArticleListItem[]) {
  return {
    articles: articles.length,
    authors: new Set(articles.map((a) => a.authorId)).size,
    views: articles.reduce((sum, a) => sum + a.views, 0),
    likes: articles.reduce((sum, a) => sum + a.likes, 0),
  };
}
