import {
  type TermVector,
  termFrequencies,
  tokenize,
} from "@readhub/shared";
import { z } from "zod";

import type { ReadHubContext } from "../../context.js";

// ============================================================================
// Base común de las Tools de análisis multi-documento.
//
// Aquí vive la ORQUESTACIÓN de dominio: cargar artículos con su texto y su
// vector de términos. La matemática de texto (tokenizar, frecuencias, coseno,
// TF-IDF) es genérica y vive en @readhub/shared; el contenido de los documentos
// lo da rag.articleContent. Esta capa solo une ambas cosas.
// ============================================================================

/** Tope de documentos a barrer cuando una Tool opera sobre "todos". */
export const MAX_CORPUS = 25;

/** Un artículo cargado y preparado para el análisis léxico. */
export interface LoadedArticle {
  id: string;
  title: string;
  summary: string | null;
  categoryId: string | null;
  /** Texto del documento, o null si no era extraíble. */
  text: string | null;
  /** false si se recurrió a título + resumen por falta de texto extraíble. */
  hasText: boolean;
  tokens: string[];
  tf: TermVector;
  wordCount: number;
}

/** Esquema reutilizable: lista de ids de artículo, deduplicada por el handler. */
export const articleIdsSchema = z
  .array(z.string().uuid())
  .describe("Ids de los artículos a analizar.");

function prepare(
  id: string,
  title: string,
  summary: string | null,
  categoryId: string | null,
  text: string | null,
): LoadedArticle {
  // Sin texto extraíble, el análisis usa título + resumen: peor señal, pero
  // evita descartar el artículo por completo.
  const analysisText =
    text && text.trim().length > 0
      ? text
      : [title, summary ?? ""].join(". ");
  const tokens = tokenize(analysisText);
  return {
    id,
    title,
    summary,
    categoryId,
    text,
    hasText: Boolean(text && text.trim().length > 0),
    tokens,
    tf: termFrequencies(tokens),
    wordCount: tokens.length,
  };
}

/** Carga un artículo con su texto, o null si no existe / no es público. */
export async function loadArticle(
  ctx: ReadHubContext,
  id: string,
): Promise<LoadedArticle | null> {
  const { supabase, services, rag } = ctx;
  const article = await services.article.getById(supabase, id);
  if (!article) return null;
  const text = await rag.articleContent.getText(supabase, article.documentPath);
  return prepare(article.id, article.title, article.summary, article.categoryId, text);
}

/**
 * Carga un conjunto de artículos por id. Lanza si alguno no existe: una Tool de
 * comparación no debe comparar en silencio menos artículos de los pedidos.
 */
export async function loadArticles(
  ctx: ReadHubContext,
  ids: string[],
): Promise<LoadedArticle[]> {
  const unique = [...new Set(ids)];
  const loaded = await Promise.all(unique.map((id) => loadArticle(ctx, id)));

  const missing = unique.filter((_, i) => loaded[i] === null);
  if (missing.length > 0) {
    throw new Error(
      `No existe(n) o no son públicos: ${missing.join(", ")}.`,
    );
  }
  return loaded as LoadedArticle[];
}

/**
 * Carga un corpus: los `ids` indicados, o TODOS los artículos públicos (hasta
 * MAX_CORPUS) si no se indica ninguno. Es la base de las Tools que operan sobre
 * el conjunto completo (temas, relaciones).
 */
export async function loadCorpus(
  ctx: ReadHubContext,
  ids?: string[],
): Promise<{ articles: LoadedArticle[]; truncated: boolean }> {
  if (ids && ids.length > 0) {
    return { articles: await loadArticles(ctx, ids), truncated: false };
  }

  const list = await ctx.services.article.list(ctx.supabase);
  const capped = list.slice(0, MAX_CORPUS);

  // Se reutiliza loadArticle (misma carga getById + getText + prepare). Un id que
  // deje de resolverse entre el list y el getById —borrado o RLS— se descarta en
  // vez de romper el corpus entero.
  const loaded = await Promise.all(capped.map((a) => loadArticle(ctx, a.id)));
  const articles = loaded.filter((a): a is LoadedArticle => a !== null);

  return { articles, truncated: list.length > capped.length };
}
