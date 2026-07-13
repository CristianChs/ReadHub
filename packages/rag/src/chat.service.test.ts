import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TypedSupabaseClient } from "@readhub/database";
import type { ChatStreamEvent, RetrievedChunk } from "@readhub/types";

// El LLM (Groq) se sustituye, pero se conservan los prompts reales del paquete:
// el cortocircuito debe verificarse contra la CONSTANTE de verdad, no contra una
// copia que podría divergir.
vi.mock("@readhub/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@readhub/ai")>()),
  generateAnswer: vi.fn(),
  streamAnswer: vi.fn(),
}));

vi.mock("./vector-search.service", () => ({
  vectorSearchService: { search: vi.fn() },
}));

import { NO_CONTEXT_ANSWER, generateAnswer, streamAnswer } from "@readhub/ai";
import { chatService } from "./chat.service";
import { vectorSearchService } from "./vector-search.service";

// ============================================================================
// chat.service — orquestador del RAG.
//
// Lo que de verdad importa aquí es EL CORTOCIRCUITO: sin contexto, se responde
// la frase canónica sin invocar al modelo. Es la regla de negocio "no inventar",
// y se cumple de forma determinista en el código, sin depender de que el LLM
// obedezca el prompt. Por eso se prueba que el proveedor NO se llama.
// ============================================================================

const supabase = {} as TypedSupabaseClient;

const chunk = (overrides: Partial<RetrievedChunk> = {}): RetrievedChunk => ({
  articleId: "art-1",
  title: "SCRUM Práctico",
  chunkIndex: 0,
  content:
    "El sprint es una iteración de duración fija en la que el equipo entrega valor.",
  similarity: 0.51,
  ...overrides,
});

beforeEach(() => {
  vi.mocked(generateAnswer).mockReset().mockResolvedValue({
    text: "Un sprint es una iteración [1].",
    model: "llama-3.3-70b-versatile",
    stopReason: "stop",
    usage: { inputTokens: 100, outputTokens: 20 },
  });

  vi.mocked(streamAnswer).mockReset().mockImplementation(async function* () {
    yield { type: "delta", text: "Un sprint " };
    yield { type: "delta", text: "es una iteración [1]." };
    yield {
      type: "done",
      model: "llama-3.3-70b-versatile",
      usage: { inputTokens: 100, outputTokens: 20 },
    };
  } as never);

  vi.mocked(vectorSearchService.search).mockReset();
});

describe("answerFromChunks — entradas inválidas", () => {
  it.each([
    ["vacía", ""],
    ["solo espacios", "   "],
  ])("rechaza una consulta %s", async (_caso, query) => {
    await expect(chatService.answerFromChunks(query, [chunk()])).rejects.toThrow(
      "La consulta no puede estar vacía.",
    );
    expect(generateAnswer).not.toHaveBeenCalled();
  });
});

describe("answerFromChunks — cortocircuito sin contexto", () => {
  it("responde la frase canónica SIN llamar al modelo cuando no hay fragmentos", async () => {
    const response = await chatService.answerFromChunks("¿qué es la fotosíntesis?", []);

    expect(response.answer).toBe(NO_CONTEXT_ANSWER);
    expect(response.hasContext).toBe(false);
    expect(response.sources).toEqual([]);
    expect(response.metadata.llmInvoked).toBe(false);
    expect(response.metadata.model).toBeNull();
    expect(response.metadata.usage).toBeNull();

    // Lo esencial: no se gastó una llamada al proveedor, y no hubo ocasión de
    // alucinar. La regla se cumple en el código, no en el prompt.
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it("también cortocircuita si los fragmentos existen pero quedan bajo el umbral", async () => {
    const response = await chatService.answerFromChunks("¿qué es scrum?", [
      chunk({ similarity: 0.05 }),
    ]);

    expect(response.answer).toBe(NO_CONTEXT_ANSWER);
    expect(response.metadata.llmInvoked).toBe(false);
    expect(response.metadata.chunksRetrieved).toBe(1);
    expect(response.metadata.chunksUsed).toBe(0);
    expect(generateAnswer).not.toHaveBeenCalled();
  });
});

describe("answerFromChunks — con contexto", () => {
  it("invoca al modelo con el prompt construido y devuelve su respuesta", async () => {
    const response = await chatService.answerFromChunks("¿qué es un sprint?", [
      chunk(),
    ]);

    expect(response.hasContext).toBe(true);
    expect(response.answer).toBe("Un sprint es una iteración [1].");
    expect(response.metadata.llmInvoked).toBe(true);
    expect(response.metadata.model).toBe("llama-3.3-70b-versatile");
    expect(response.metadata.chunksUsed).toBe(1);

    const [args] = vi.mocked(generateAnswer).mock.calls[0];
    expect(args.system).toContain("ReadHub");
    expect(args.user).toContain("El sprint es una iteración");
  });

  it("expone las fuentes para que la interfaz pueda citarlas", async () => {
    const response = await chatService.answerFromChunks("scrum", [chunk()]);

    expect(response.sources).toEqual([
      expect.objectContaining({ articleId: "art-1", url: "/article/art-1" }),
    ]);
  });

  it("propaga el fallo del proveedor de LLM", async () => {
    vi.mocked(generateAnswer).mockRejectedValue(new Error("Groq respondió 429."));

    await expect(
      chatService.answerFromChunks("scrum", [chunk()]),
    ).rejects.toThrow("429");
  });
});

describe("ask — flujo completo", () => {
  it("recupera y responde reutilizando los mismos services", async () => {
    vi.mocked(vectorSearchService.search).mockResolvedValue({
      query: "scrum",
      chunks: [chunk()],
      articles: [],
      applied: { topK: 5, threshold: 0.3 },
    });

    const response = await chatService.ask(supabase, "scrum");

    expect(vectorSearchService.search).toHaveBeenCalledWith(
      supabase,
      "scrum",
      undefined,
    );
    expect(response.hasContext).toBe(true);
    expect(generateAnswer).toHaveBeenCalledOnce();
  });

  it("propaga el fallo de la recuperación sin invocar al modelo", async () => {
    vi.mocked(vectorSearchService.search).mockRejectedValue(
      new Error("permission denied"),
    );

    await expect(chatService.ask(supabase, "scrum")).rejects.toThrow(
      "permission denied",
    );
    expect(generateAnswer).not.toHaveBeenCalled();
  });
});

describe("askStream — streaming", () => {
  async function collect(query: string): Promise<ChatStreamEvent[]> {
    const events: ChatStreamEvent[] = [];
    for await (const event of chatService.askStream(supabase, query)) {
      events.push(event);
    }
    return events;
  }

  it("emite meta -> deltas -> done, en ese orden", async () => {
    vi.mocked(vectorSearchService.search).mockResolvedValue({
      query: "scrum",
      chunks: [chunk()],
      articles: [],
      applied: { topK: 5, threshold: 0.3 },
    });

    const events = await collect("scrum");

    expect(events.map((e) => e.type)).toEqual(["meta", "delta", "delta", "done"]);
  });

  it("las fuentes viajan en el PRIMER evento, antes de generar el texto", async () => {
    // La interfaz puede pintarlas mientras el modelo todavía está escribiendo.
    vi.mocked(vectorSearchService.search).mockResolvedValue({
      query: "scrum",
      chunks: [chunk()],
      articles: [],
      applied: { topK: 5, threshold: 0.3 },
    });

    const [primero] = await collect("scrum");

    expect(primero).toMatchObject({
      type: "meta",
      hasContext: true,
      sources: [expect.objectContaining({ articleId: "art-1" })],
    });
  });

  it("cortocircuita en streaming exactamente igual que ask", async () => {
    vi.mocked(vectorSearchService.search).mockResolvedValue({
      query: "fotosíntesis",
      chunks: [],
      articles: [],
      applied: { topK: 5, threshold: 0.3 },
    });

    const events = await collect("fotosíntesis");

    expect(events.map((e) => e.type)).toEqual(["meta", "delta", "done"]);
    expect(events[1]).toMatchObject({ type: "delta", text: NO_CONTEXT_ANSWER });
    expect(events[2]).toMatchObject({ metadata: { llmInvoked: false } });
    expect(streamAnswer).not.toHaveBeenCalled();
  });

  it("rechaza una consulta vacía antes de recuperar nada", async () => {
    await expect(collect("   ")).rejects.toThrow("La consulta no puede estar vacía.");
    expect(vectorSearchService.search).not.toHaveBeenCalled();
  });
});
