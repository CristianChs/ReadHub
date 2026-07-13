import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { articleService } from "@readhub/services";
import { authService } from "@readhub/services";
import { indexingService } from "@readhub/rag";

// POST /api/v1/articles/{id}/index
//
// Dispara la indexación vectorial de un artículo. Es la frontera entre el
// navegador y la lógica RAG: aquí viven las claves del servidor, la
// autenticación y la comprobación de propiedad. Ningún componente React puede
// alcanzar los Services sin pasar por aquí.
//
// Idempotente: reindexar produce siempre el mismo estado.

// La extracción de PDF/DOCX usa librerías de Node: no puede correr en Edge.
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();

  const user = await authService.getCurrentUser(supabase);
  if (!user) {
    return apiError("UNAUTHENTICATED", "Debes iniciar sesión.", 401);
  }

  let article;
  try {
    article = await articleService.getById(supabase, id);
  } catch {
    return apiError("INTERNAL_ERROR", "No se pudo leer el artículo.", 500);
  }

  if (!article) {
    return apiError("NOT_FOUND", "El artículo no existe.", 404);
  }

  // Solo el autor indexa su artículo. La RLS de article_embeddings es la
  // garantía final, pero se rechaza antes para no gastar cuota de embeddings.
  if (article.authorId !== user.id) {
    return apiError("FORBIDDEN", "No eres el autor de este artículo.", 403);
  }

  try {
    const result = await indexingService.indexArticle(supabase, article);
    return apiSuccess(result);
  } catch (error) {
    // No se filtra el error interno del proveedor ni de la base de datos.
    console.error("[index] fallo al indexar el artículo", id, error);
    return apiError(
      "INDEXING_FAILED",
      "No se pudo indexar el artículo.",
      500,
    );
  }
}
