import type { TypedSupabaseClient } from "@readhub/database";
import { extractDocumentText } from "@readhub/shared";
import { storageService } from "@readhub/services";

// ============================================================================
// article-content.service — texto plano del documento de un artículo.
//
//   documento en storage -> bytes -> texto plano
//
// Es la ÚNICA ruta de extracción de texto de la plataforma. La usa el indexador
// (antes de trocear y vectorizar) y la usan los Prompts (para dar material al
// LLM del cliente). Al vivir en un solo sitio, ambos caminos se comportan igual.
//
// No requiere ningún proveedor externo: solo descarga de storage y extracción
// local (unpdf / mammoth). Por eso es SOLO SERVIDOR, como el resto de @readhub/rag.
// ============================================================================

/**
 * Texto del documento de un artículo, o null.
 *
 * Devuelve null en vez de lanzar cuando el documento no existe, no es legible o
 * no tiene texto (PDF escaneado, formato no soportado, objeto borrado del
 * bucket). Degradación controlada: quien llama decide qué hacer sin contenido.
 */
async function getText(
  supabase: TypedSupabaseClient,
  documentPath: string | null,
): Promise<string | null> {
  if (!documentPath) return null;

  try {
    const bytes = await storageService.downloadDocument(supabase, documentPath);
    return await extractDocumentText(bytes, documentPath);
  } catch {
    return null;
  }
}

export const articleContentService = {
  getText,
};
