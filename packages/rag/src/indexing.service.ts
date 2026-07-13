import type { TypedSupabaseClient } from "@readhub/database";
import { articleContentService } from "./article-content.service";
import { embeddingService } from "./embedding.service";
import type { ArticleDetail } from "@readhub/types";
import type { EmbedArticleResult } from "@readhub/types";

// ============================================================================
// indexing.service — orquesta el pipeline de indexación de un artículo:
//
//   obtener contenido -> extraer texto -> delegar en embedding.service
//
// NO genera embeddings ni habla con el proveedor: reutiliza embedding.service.
// NO resuelve autenticación ni autorización: eso pertenece al Route Handler.
//
// El borrado no aparece aquí a propósito: `article_embeddings.article_id`
// tiene ON DELETE CASCADE, de modo que eliminar un artículo elimina sus
// vectores a nivel de base de datos, sin código que pueda olvidarse de correr.
// ============================================================================

export interface IndexArticleResult extends EmbedArticleResult {
  /** false si el documento no existía, no era legible o no tenía texto. */
  contentExtracted: boolean;
}

/**
 * Indexa (o reindexa) un artículo. Idempotente: embedding.service reemplaza
 * los fragmentos previos, así que ejecutarlo N veces deja el mismo estado.
 *
 * Recibe el artículo ya resuelto para no repetir la consulta que el Route
 * Handler necesita hacer igualmente para comprobar la propiedad.
 */
async function indexArticle(
  supabase: TypedSupabaseClient,
  article: ArticleDetail,
): Promise<IndexArticleResult> {
  // Misma ruta de extracción que usan los Prompts: article-content.service.
  const content = await articleContentService.getText(
    supabase,
    article.documentPath,
  );

  const result = await embeddingService.embedArticle(supabase, {
    articleId: article.id,
    title: article.title,
    summary: article.summary,
    content,
  });

  return { ...result, contentExtracted: content !== null };
}

export const indexingService = {
  indexArticle,
};
