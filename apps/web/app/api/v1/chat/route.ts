import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/responses";
import { authService } from "@readhub/services";
import { chatService } from "@readhub/rag";

// POST /api/v1/chat
//
// Frontera entre el navegador y el sistema RAG. Aquí viven las claves del
// servidor y la autenticación; ningún componente React alcanza los Services.
//
// Responde NDJSON (una línea JSON por evento) para poder emitir la respuesta
// progresivamente sin inventar un protocolo binario:
//   {"type":"meta",...}\n {"type":"delta",...}\n ... {"type":"done",...}\n

export const runtime = "nodejs";

/**
 * Techo de la consulta. Sin él, un texto de 100 KB se vectorizaría y se
 * facturaría: es a la vez un límite de coste y de superficie de abuso.
 * Una pregunta legítima no se acerca a este tamaño.
 */
const MAX_QUERY_LENGTH = 1000;

export async function POST(request: Request) {
  const supabase = await createClient();

  // La sesión se resuelve ANTES de abrir el stream: una vez enviada la
  // cabecera ya no se puede responder con un 401.
  const user = await authService.getCurrentUser(supabase);
  if (!user) {
    return apiError("UNAUTHENTICATED", "Debes iniciar sesión.", 401);
  }

  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) {
    return apiError(
      "VALIDATION_ERROR",
      "La consulta no puede estar vacía.",
      422,
    );
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return apiError(
      "VALIDATION_ERROR",
      `La consulta no puede superar los ${MAX_QUERY_LENGTH} caracteres.`,
      422,
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        for await (const event of chatService.askStream(supabase, query)) {
          // Trazabilidad del flujo RAG: una línea estructurada por consulta,
          // al cierre. Suficiente para diagnosticar recuperación, coste y
          // latencia sin instrumentar cada etapa.
          if (event.type === "done") {
            console.info(
              "[rag]",
              JSON.stringify({
                userId: user.id,
                queryLength: query.length,
                ...event.metadata,
              }),
            );
          }
          send(event);
        }
      } catch (error) {
        // El stream ya está abierto: el error se comunica como un evento, no
        // como un código HTTP. No se filtra el detalle interno.
        console.error("[chat] fallo al generar la respuesta", error);
        send({
          type: "error",
          message: "No se pudo generar la respuesta. Inténtalo de nuevo.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
