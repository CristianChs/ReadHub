import { z } from "zod";

import { READ_ONLY_EXTERNAL, contextSourceSchema, runTool } from "./shared.js";
import type { ToolRegistrar } from "./shared.js";

/**
 * `ask_readhub` — el pipeline RAG completo, expuesto como una Tool.
 *
 *   consulta -> embedding -> búsqueda semántica -> contexto -> Claude -> respuesta
 *
 * Todo eso ya lo orquesta `chatService.ask`, el mismo que usa `/api/v1/chat`.
 * Aquí no se reimplementa ni un paso: se traduce su `ChatResponse` al formato
 * del protocolo.
 *
 * Se expone `ask`, no `askStream`: una llamada a Tool devuelve un resultado
 * único, no un flujo. El streaming pertenece a la interfaz web.
 *
 * `hasContext: false` significa que nada superó el umbral y el modelo NO fue
 * invocado. Es una respuesta correcta —"no tengo información sobre eso"—, no un
 * fallo, y por eso no se marca como error.
 *
 * Requiere `VOYAGE_API_KEY` (embeddings) y `GROQ_API_KEY` (generación).
 */
export const registerAskReadHub: ToolRegistrar = (server, getContext) => {
  server.registerTool(
    "ask_readhub",
    {
      title: "Preguntar a ReadHub (RAG)",
      description:
        "Responde una pregunta usando exclusivamente el contenido de los artículos de ReadHub, y devuelve las fuentes citadas con su enlace. Úsala cuando quieras una respuesta redactada y fundamentada. Si necesitas los fragmentos en bruto para razonar por tu cuenta, usa semantic_search_articles. Cuando hasContext es false, la plataforma no contiene información sobre la pregunta.",
      inputSchema: {
        query: z.string().min(1).describe("Pregunta en lenguaje natural."),
        topK: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Fragmentos a recuperar antes de construir el contexto."),
        threshold: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Similitud coseno mínima [0..1] de los fragmentos."),
        maxTokens: z
          .number()
          .int()
          .min(1)
          .max(4096)
          .optional()
          .describe("Techo de tokens de la respuesta generada."),
      },
      outputSchema: {
        query: z.string(),
        answer: z.string(),
        hasContext: z.boolean(),
        sources: z.array(contextSourceSchema),
        metadata: z.object({
          model: z.string().nullable(),
          llmInvoked: z.boolean(),
          chunksRetrieved: z.number(),
          chunksUsed: z.number(),
          latencyMs: z.number(),
          usage: z
            .object({ inputTokens: z.number(), outputTokens: z.number() })
            .nullable(),
        }),
      },
      annotations: READ_ONLY_EXTERNAL,
    },
    async ({ query, topK, threshold, maxTokens }) =>
      runTool("ask_readhub", async () => {
        const { supabase, rag } = getContext();
        const response = await rag.chat.ask(supabase, query, {
          retrieval: { topK, threshold },
          maxTokens,
        });

        const citations = response.sources
          .map((s) => `[${s.rank}] ${s.title} — ${s.url}`)
          .join("\n");

        const text = response.hasContext
          ? `${response.answer}\n\nFuentes:\n${citations}`
          : response.answer;

        const { metadata } = response;

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            query: response.query,
            answer: response.answer,
            hasContext: response.hasContext,
            sources: response.sources,
            metadata: {
              model: metadata.model,
              llmInvoked: metadata.llmInvoked,
              chunksRetrieved: metadata.chunksRetrieved,
              chunksUsed: metadata.chunksUsed,
              latencyMs: metadata.latencyMs,
              usage: metadata.usage,
            },
          },
        };
      }),
  );
};
