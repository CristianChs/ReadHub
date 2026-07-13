import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArticleListItem } from "@readhub/types";

import type { ContextFactory } from "../context.js";

// ============================================================================
// Piezas comunes a todas las Tools.
//
// Aquí NO hay lógica de negocio: solo el contrato de registro, los esquemas de
// salida y la traducción de errores al formato del protocolo.
// ============================================================================

/**
 * Contrato de una Tool. Cada fichero de `tools/` exporta uno de estos y el
 * índice los registra en bucle: añadir una Tool es añadir un fichero y una
 * entrada en el array, sin tocar el servidor.
 */
export interface ToolRegistrar {
  (server: McpServer, getContext: ContextFactory): void;
}

/** Forma de `ArticleListItem` (@readhub/types) como esquema de salida. */
export const articleListItemShape = {
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  imagePath: z.string().nullable(),
  authorId: z.string(),
  createdAt: z.string(),
  categoryId: z.string().nullable(),
  views: z.number(),
  likes: z.number(),
} as const;

export const articleListItemSchema = z.object(articleListItemShape);

// Guarda de deriva (solo tipos, sin coste en runtime): el esquema de salida se
// mantiene a mano en zod porque MCP lo exige, pero debe seguir describiendo la
// MISMA forma que el tipo de dominio. Si `ArticleListItem` cambia y este esquema
// no (o al revés), una de estas dos restricciones deja de cumplirse y el
// proyecto no compila, en vez de derivar en silencio.
type AssertExtends<T extends U, U> = T;
type _SchemaFitsDomain = AssertExtends<
  z.infer<typeof articleListItemSchema>,
  ArticleListItem
>;
type _DomainFitsSchema = AssertExtends<
  ArticleListItem,
  z.infer<typeof articleListItemSchema>
>;

/** Forma de `ContextSource` (@readhub/types). Lo que permite citar una fuente. */
export const contextSourceSchema = z.object({
  rank: z.number(),
  articleId: z.string(),
  title: z.string(),
  similarity: z.number(),
  chunkIndexes: z.array(z.number()),
  url: z.string(),
});

/** Forma de `RetrievedChunk` (@readhub/types). */
export const retrievedChunkSchema = z.object({
  articleId: z.string(),
  title: z.string(),
  chunkIndex: z.number(),
  content: z.string(),
  similarity: z.number(),
});

/** Anotaciones de una Tool de solo lectura contra la base de datos. */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/**
 * Igual que `READ_ONLY`, pero la Tool además llama a proveedores externos
 * (Voyage para los embeddings, Groq para la generación). `openWorldHint`
 * le dice al cliente que el resultado no depende solo de ReadHub.
 */
export const READ_ONLY_EXTERNAL = {
  ...READ_ONLY,
  idempotentHint: false,
  openWorldHint: true,
} as const;

/** Resultado de error visible para el modelo, en vez de una excepción opaca. */
function failure(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

/**
 * Extrae un mensaje legible de cualquier cosa que se haya lanzado.
 *
 * PostgREST no lanza `Error`: lanza objetos planos `{ message, code, details,
 * hint }`. Un `String(error)` los convierte en "[object Object]" y el modelo se
 * queda sin saber qué pasó, que es exactamente lo que no queremos.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const { message, code, details, hint } = error as Record<string, unknown>;
    if (typeof message === "string") {
      const extra = [code && `código ${code}`, details, hint]
        .filter(Boolean)
        .join("; ");
      return extra ? `${message} (${extra})` : message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      /* cae al String() de abajo */
    }
  }

  return String(error);
}

/**
 * Traduce cualquier excepción de la capa de negocio a un error de Tool.
 *
 * Se devuelve `isError` en lugar de propagar: así el modelo lee el motivo y
 * puede corregir el rumbo, que es justamente lo que recomienda el SDK. Además,
 * cuando hay `outputSchema`, un resultado de error queda exento de validarlo.
 *
 * Los fallos de configuración (falta `SUPABASE_URL`, `VOYAGE_API_KEY`,
 * `GROQ_API_KEY`) llegan aquí como excepciones y se explican tal cual: el
 * servidor no puede resolverlos, pero el usuario sí.
 */
export async function runTool<T>(
  operation: string,
  execute: () => Promise<T>,
): Promise<T | ReturnType<typeof failure>> {
  try {
    return await execute();
  } catch (error) {
    return failure(`${operation} falló: ${describeError(error)}`);
  }
}
