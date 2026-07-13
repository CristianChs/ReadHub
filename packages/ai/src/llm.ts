import OpenAI from "openai";

// ============================================================================
// Cliente del proveedor de LLM — ÚNICO punto del proyecto que habla con el
// modelo generativo. Detrás va Groq a través de su API compatible con OpenAI,
// así que el mismo código sirve para cualquier proveedor compatible (Groq,
// Ollama, OpenRouter, Together…) cambiando solo `GROQ_BASE_URL`, el modelo y la
// clave. `generateAnswer`/`streamAnswer` son un contrato agnóstico: ningún
// consumidor conoce el SDK ni el proveedor.
//
// SOLO SERVIDOR: usa GROQ_API_KEY, que nunca debe llegar al navegador (sin
// prefijo NEXT_PUBLIC_).
// ============================================================================

/** Endpoint compatible con OpenAI de Groq. */
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/** Modelo por defecto. Se puede sobreescribir con la variable GROQ_MODEL. */
export const CHAT_MODEL = "llama-3.3-70b-versatile";

/** Techo de la respuesta. Las respuestas del asistente son breves y citadas. */
const DEFAULT_MAX_TOKENS = 4096;

function chatModel(): string {
  return process.env.GROQ_MODEL || CHAT_MODEL;
}

/** Contrato agnóstico: ningún consumidor conoce los tipos del SDK. */
export interface LlmAnswer {
  text: string;
  model: string;
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
}

export interface GenerateAnswerInput {
  system: string;
  user: string;
  maxTokens?: number;
}

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta GROQ_API_KEY. Define la variable de entorno en el servidor " +
        "(sin prefijo NEXT_PUBLIC_).",
    );
  }
  cachedClient ??= new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
  return cachedClient;
}

/**
 * Genera una respuesta a partir de unas instrucciones de sistema y un turno de
 * usuario ya construidos. No sabe nada de RAG, contexto ni fuentes: recibe dos
 * cadenas y devuelve texto.
 */
export async function generateAnswer({
  system,
  user,
  maxTokens = DEFAULT_MAX_TOKENS,
}: GenerateAnswerInput): Promise<LlmAnswer> {
  const response = await getClient().chat.completions.create({
    model: chatModel(),
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const choice = response.choices[0];
  const text = (choice?.message?.content ?? "").trim();

  return {
    text,
    model: response.model,
    stopReason: choice?.finish_reason ?? null,
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
      : null,
  };
}

/** Eventos del generador en streaming. Agnósticos del proveedor. */
export type LlmStreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      model: string;
      stopReason: string | null;
      usage: { inputTokens: number; outputTokens: number } | null;
    };

/**
 * Variante en streaming de `generateAnswer`. Emite el texto a medida que el
 * modelo lo produce y cierra con los metadatos finales.
 *
 * `stream_options.include_usage` pide a Groq un último fragmento con el uso de
 * tokens (viene con `choices` vacío, por eso se lee aparte).
 */
export async function* streamAnswer({
  system,
  user,
  maxTokens = DEFAULT_MAX_TOKENS,
}: GenerateAnswerInput): AsyncGenerator<LlmStreamEvent> {
  const stream = await getClient().chat.completions.create({
    model: chatModel(),
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  let model = chatModel();
  let stopReason: string | null = null;
  let usage: { inputTokens: number; outputTokens: number } | null = null;

  for await (const chunk of stream) {
    if (chunk.model) model = chunk.model;

    const choice = chunk.choices[0];
    if (choice) {
      if (choice.delta?.content) {
        yield { type: "delta", text: choice.delta.content };
      }
      if (choice.finish_reason) stopReason = choice.finish_reason;
    }

    if (chunk.usage) {
      usage = {
        inputTokens: chunk.usage.prompt_tokens,
        outputTokens: chunk.usage.completion_tokens,
      };
    }
  }

  yield { type: "done", model, stopReason, usage };
}
