import type { TypedSupabaseClient } from "@readhub/database";
import { NO_CONTEXT_ANSWER } from "@readhub/ai";
import { generateAnswer, streamAnswer } from "@readhub/ai";
import { contextBuilderService } from "./context-builder.service";
import { vectorSearchService } from "./vector-search.service";
import type {
  BuiltContext,
  ChatMetadata,
  ChatOptions,
  ChatResponse,
  ChatStreamEvent,
} from "@readhub/types";
import type { RetrievedChunk } from "@readhub/types";

// ============================================================================
// chat.service — orquestador del flujo RAG. Único punto de entrada del
// asistente inteligente.
//
// NO recupera, NO vectoriza, NO construye contexto: coordina.
//   embedding.service   -> lo usa vector-search
//   vector-search       -> recupera fragmentos
//   context-builder     -> selecciona y arma el prompt
//   lib/ai/claude       -> genera la respuesta
//
// Es el único consumidor de lib/ai/claude: ningún otro módulo conoce al
// proveedor de LLM. Sustituirlo implica reescribir lib/ai/claude.ts.
// ============================================================================

// --- Utilidades internas compartidas por `ask`, `askStream` y `answerFromChunks`.
// Existen para que la validación, el mapeo de métricas y el cortocircuito
// tengan una única definición y no puedan divergir entre la variante en
// streaming y la que responde de golpe.

function validateQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("La consulta no puede estar vacía.");
  return trimmed;
}

/** Métricas del proceso, derivadas del contexto construido. */
function toStats(context: BuiltContext) {
  return {
    chunksRetrieved: context.stats.chunksRetrieved,
    chunksUsed: context.stats.chunksSelected,
    charBudget: context.stats.charBudget,
    charsUsed: context.stats.charsUsed,
    dropped: context.stats.dropped,
  };
}

/** Metadatos cuando NO se invocó al modelo (cortocircuito). */
function shortCircuitMetadata(
  context: BuiltContext,
  startedAt: number,
): ChatMetadata {
  return {
    ...toStats(context),
    model: null,
    llmInvoked: false,
    usage: null,
    latencyMs: Date.now() - startedAt,
  };
}

/**
 * Responde a partir de unos fragmentos ya recuperados.
 *
 * Se expone aparte de `ask` a propósito: permite responder sobre un conjunto
 * de fragmentos obtenido por otra vía (re-ranking, caché, búsqueda encadenada)
 * sin repetir la recuperación. Es también la costura que hace verificable el
 * cortocircuito sin depender de ningún proveedor.
 */
async function answerFromChunks(
  query: string,
  chunks: RetrievedChunk[],
  options?: ChatOptions,
): Promise<ChatResponse> {
  const startedAt = Date.now();

  const context = contextBuilderService.buildContext(
    validateQuery(query),
    chunks,
    options?.context,
  );

  const base = {
    query: context.query,
    hasContext: context.hasContext,
    sources: context.sources,
  };

  // Cortocircuito: sin contexto no hay nada que fundamentar. Responder con la
  // frase canónica es determinista y no gasta una llamada al modelo. La regla
  // de negocio ("no inventar") se cumple sin depender de que el LLM obedezca.
  if (!context.hasContext) {
    return {
      ...base,
      answer: NO_CONTEXT_ANSWER,
      metadata: shortCircuitMetadata(context, startedAt),
    };
  }

  const answer = await generateAnswer({
    system: context.systemPrompt,
    user: context.userPrompt,
    maxTokens: options?.maxTokens,
  });

  return {
    ...base,
    answer: answer.text,
    metadata: {
      ...toStats(context),
      model: answer.model,
      llmInvoked: true,
      usage: answer.usage,
      latencyMs: Date.now() - startedAt,
    },
  };
}

/**
 * Flujo RAG completo.
 *
 *   consulta -> embedding -> búsqueda semántica -> contexto -> Claude -> respuesta
 *
 * Los pasos 2 y 3 los ejecuta vector-search.service (que delega el embedding en
 * embedding.service); el 4 lo ejecuta context-builder.service. Aquí no se
 * duplica ninguno.
 */
async function ask(
  supabase: TypedSupabaseClient,
  query: string,
  options?: ChatOptions,
): Promise<ChatResponse> {
  const trimmed = validateQuery(query);

  const retrieval = await vectorSearchService.search(
    supabase,
    trimmed,
    options?.retrieval,
  );

  return answerFromChunks(trimmed, retrieval.chunks, options);
}

/**
 * Flujo RAG completo en streaming.
 *
 * Idéntico a `ask` salvo en cómo entrega la respuesta. Reutiliza exactamente
 * los mismos services y el mismo cortocircuito; lo único que cambia es que el
 * texto se emite por partes. `ask` sigue existiendo sin modificaciones.
 */
async function* askStream(
  supabase: TypedSupabaseClient,
  query: string,
  options?: ChatOptions,
): AsyncGenerator<ChatStreamEvent> {
  const startedAt = Date.now();
  const trimmed = validateQuery(query);

  const retrieval = await vectorSearchService.search(
    supabase,
    trimmed,
    options?.retrieval,
  );

  const context = contextBuilderService.buildContext(
    trimmed,
    retrieval.chunks,
    options?.context,
  );

  // Las fuentes se conocen antes de generar: la interfaz puede pintarlas ya.
  yield {
    type: "meta",
    query: context.query,
    hasContext: context.hasContext,
    sources: context.sources,
  };

  // Mismo cortocircuito determinista que en `answerFromChunks`.
  if (!context.hasContext) {
    yield { type: "delta", text: NO_CONTEXT_ANSWER };
    yield { type: "done", metadata: shortCircuitMetadata(context, startedAt) };
    return;
  }

  for await (const event of streamAnswer({
    system: context.systemPrompt,
    user: context.userPrompt,
    maxTokens: options?.maxTokens,
  })) {
    if (event.type === "delta") {
      yield event;
      continue;
    }
    yield {
      type: "done",
      metadata: {
        ...toStats(context),
        model: event.model,
        llmInvoked: true,
        usage: event.usage,
        latencyMs: Date.now() - startedAt,
      },
    };
  }
}

export const chatService = {
  ask,
  askStream,
  answerFromChunks,
};
