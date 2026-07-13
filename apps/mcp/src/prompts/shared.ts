import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ArticleDetail } from "@readhub/types";

import type { ContextFactory, ReadHubContext } from "../context.js";

// ============================================================================
// Piezas comunes a todos los Prompts.
//
// Un Prompt de MCP NO ejecuta ni llama al LLM: devuelve una plantilla de
// mensajes que el cliente entrega a SU modelo. Por eso aquí no hay generación
// (eso es la Tool `ask_readhub`); solo se ensambla la instrucción y el material.
//
// El material real del artículo se obtiene de `rag.articleContent`, la MISMA
// ruta de extracción que usa el indexador. No se duplica ninguna consulta.
// ============================================================================

export interface PromptRegistrar {
  (server: McpServer, getContext: ContextFactory): void;
}

export const DEFAULT_LANGUAGE = "español";

/**
 * Idioma de la respuesta. Todos los Prompts lo aceptan.
 *
 * Es `.optional()` en vez de `.default()` a propósito: el SDK deriva la lista de
 * argumentos de `prompts/list` de este esquema, y trata un `.default()` como
 * argumento REQUERIDO. Para que se anuncie como opcional (que es lo que es), se
 * declara opcional aquí y el valor por defecto se aplica en el handler. Lo mismo
 * vale para los demás argumentos con default (length, level, count, type).
 */
export const LANGUAGE_ARG = z
  .string()
  .optional()
  .describe("Idioma de la respuesta. Por defecto español.");

/** Tope de texto embebido: evita plantillas desmesuradas con documentos largos. */
const MAX_CONTENT_CHARS = 24_000;

/**
 * Argumento `articleId` con autocompletado.
 *
 * El completado reutiliza `articleService.list`: al teclear, el cliente ve los
 * id de los artículos cuyo título (o id) coincide. Reutilización pura, sin
 * consulta nueva.
 */
export function articleIdArg(getContext: ContextFactory, description: string) {
  return completable(z.string().describe(description), async (value) => {
    const { supabase, services } = getContext();
    const articles = await services.article.list(supabase);
    const needle = value.trim().toLowerCase();
    return articles
      .filter(
        (a) =>
          needle.length === 0 ||
          a.title.toLowerCase().includes(needle) ||
          a.id.includes(needle),
      )
      .slice(0, 20)
      .map((a) => a.id);
  });
}

export interface ArticleMaterial {
  article: ArticleDetail;
  authorName: string | null;
  /** Texto plano del documento, o null si no es extraíble. */
  text: string | null;
}

/**
 * Carga un artículo y su texto para embeberlo en un Prompt.
 *
 * Lanza si el artículo no existe o no es público: un Prompt que apunta a un
 * artículo inexistente no puede construirse.
 */
export async function loadArticleMaterial(
  ctx: ReadHubContext,
  id: string,
): Promise<ArticleMaterial> {
  const { supabase, services, rag } = ctx;

  const article = await services.article.getById(supabase, id);
  if (!article) {
    throw new Error(`No existe ningún artículo público con id ${id}.`);
  }

  const [names, text] = await Promise.all([
    services.auth.getAuthorNames(supabase, [article.authorId]),
    rag.articleContent.getText(supabase, article.documentPath),
  ]);

  return { article, authorName: names[article.authorId] ?? null, text };
}

/** Renderiza un artículo como bloque de texto plano para el mensaje del Prompt. */
export function renderArticleBlock(material: ArticleMaterial): string {
  const { article, authorName, text } = material;

  const body = text
    ? text.length > MAX_CONTENT_CHARS
      ? `${text.slice(0, MAX_CONTENT_CHARS)}\n\n[...contenido truncado...]`
      : text
    : "(No hay texto extraíble del documento. Trabaja con el título y el resumen; si son insuficientes, indícalo.)";

  return [
    "=== ARTÍCULO ===",
    `Título: ${article.title}`,
    `Autor: ${authorName ?? "desconocido"}`,
    `Resumen: ${article.summary ?? "(sin resumen)"}`,
    "",
    "Contenido:",
    body,
  ].join("\n");
}

/** Un único mensaje de usuario con instrucción + material. */
export function userPrompt(text: string): GetPromptResult {
  return {
    messages: [
      { role: "user", content: { type: "text", text } },
    ],
  };
}
