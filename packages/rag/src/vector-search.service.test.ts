import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TypedSupabaseClient } from "@readhub/database";
import type { Embedding } from "@readhub/types";

// El proveedor de embeddings (Voyage) se sustituye ANTES de importar el módulo
// bajo prueba: `vi.mock` se iza. Así ninguna prueba toca la red ni gasta cuota.
vi.mock("./embedding.service", () => ({
  embeddingService: {
    embedQuery: vi.fn(),
  },
}));

import { embeddingService } from "./embedding.service";
import {
  DEFAULT_THRESHOLD,
  DEFAULT_TOP_K,
  vectorSearchService,
} from "./vector-search.service";

// ============================================================================
// vector-search.service — recuperación semántica.
//
// Dos dependencias externas, ambas sustituidas:
//   - el proveedor de embeddings  -> mock del módulo (arriba)
//   - PostgreSQL (match_article_chunks) -> cliente falso con `rpc` (abajo)
//
// Lo que se prueba es SUYO: los clamps de los parámetros, el mapeo de las filas
// y la agrupación por artículo. La similitud la calcula Postgres; aquí no se
// reimplementa ni se verifica.
// ============================================================================

const VECTOR: Embedding = Array.from({ length: 1024 }, () => 0.1) as Embedding;

interface RpcRow {
  article_id: string;
  article_title: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

/** Cliente falso: solo necesita `rpc`, que es lo único que usa este service. */
function createSupabaseFake(result: { data: RpcRow[] | null; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as TypedSupabaseClient, rpc };
}

function row(overrides: Partial<RpcRow> = {}): RpcRow {
  return {
    article_id: "art-1",
    article_title: "SCRUM Práctico",
    chunk_index: 0,
    content: "El sprint es una iteración de duración fija.",
    similarity: 0.51,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(embeddingService.embedQuery).mockReset().mockResolvedValue(VECTOR);
});

describe("search — entradas inválidas", () => {
  it.each([
    ["vacía", ""],
    ["solo espacios", "   "],
  ])("lanza ante una consulta %s sin vectorizar nada", async (_caso, query) => {
    const { client, rpc } = createSupabaseFake({ data: [], error: null });

    await expect(vectorSearchService.search(client, query)).rejects.toThrow(
      "La consulta no puede estar vacía.",
    );

    // Cortocircuito: no se gasta una llamada al proveedor ni una a la BD.
    expect(embeddingService.embedQuery).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("search — flujo de recuperación", () => {
  it("vectoriza la consulta recortada y busca con ese vector", async () => {
    const { client, rpc } = createSupabaseFake({ data: [row()], error: null });

    const result = await vectorSearchService.search(client, "  ¿qué es scrum?  ");

    expect(embeddingService.embedQuery).toHaveBeenCalledWith("¿qué es scrum?");
    expect(result.query).toBe("¿qué es scrum?");

    const [fn, params] = rpc.mock.calls[0];
    expect(fn).toBe("match_article_chunks");
    // El vector viaja serializado como literal de pgvector, no como array JS.
    expect(params.query_embedding).toBe(JSON.stringify(VECTOR));
  });

  it("mapea las filas de la BD al modelo de dominio", async () => {
    const { client } = createSupabaseFake({ data: [row()], error: null });

    const { chunks } = await vectorSearchService.search(client, "scrum");

    expect(chunks[0]).toEqual({
      articleId: "art-1",
      title: "SCRUM Práctico",
      chunkIndex: 0,
      content: "El sprint es una iteración de duración fija.",
      similarity: 0.51,
    });
  });

  it("devuelve un resultado vacío cuando nada supera el umbral", async () => {
    // No es un error: es la respuesta legítima que habilita el "no tengo
    // información sobre eso" del asistente.
    const { client } = createSupabaseFake({ data: [], error: null });

    const result = await vectorSearchService.search(client, "física cuántica");

    expect(result.chunks).toEqual([]);
    expect(result.articles).toEqual([]);
  });

  it("tolera data null", async () => {
    const { client } = createSupabaseFake({ data: null, error: null });

    const result = await vectorSearchService.search(client, "scrum");

    expect(result.chunks).toEqual([]);
  });

  it("propaga el error del RPC (p. ej. RLS denegando match_article_chunks)", async () => {
    const { client } = createSupabaseFake({
      data: null,
      error: { code: "42501", message: "permission denied for function" },
    });

    await expect(vectorSearchService.search(client, "scrum")).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("propaga el fallo del proveedor de embeddings sin llegar a la BD", async () => {
    vi.mocked(embeddingService.embedQuery).mockRejectedValue(
      new Error("El proveedor de embeddings respondió 401."),
    );
    const { client, rpc } = createSupabaseFake({ data: [], error: null });

    await expect(vectorSearchService.search(client, "scrum")).rejects.toThrow(
      "401",
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("resolveOptions — límites duros", () => {
  it("aplica los valores por defecto", async () => {
    const { client, rpc } = createSupabaseFake({ data: [], error: null });

    const result = await vectorSearchService.search(client, "scrum");

    expect(rpc.mock.calls[0][1]).toMatchObject({
      match_threshold: DEFAULT_THRESHOLD,
      match_count: DEFAULT_TOP_K,
    });
    expect(result.applied).toEqual({
      topK: DEFAULT_TOP_K,
      threshold: DEFAULT_THRESHOLD,
    });
  });

  it("el umbral por defecto es 0.3 (valor calibrado, no arbitrario)", () => {
    expect(DEFAULT_THRESHOLD).toBe(0.3);
  });

  it.each([
    ["topK negativo", { topK: -5 }, 1],
    ["topK a cero", { topK: 0 }, 1],
    ["topK desorbitado", { topK: 9999 }, 20],
  ])("recorta un %s", async (_caso, options, esperado) => {
    // Un llamador no debe poder desbordar el contexto ni la memoria del servidor.
    const { client, rpc } = createSupabaseFake({ data: [], error: null });

    await vectorSearchService.search(client, "scrum", options);

    expect(rpc.mock.calls[0][1].match_count).toBe(esperado);
  });

  it.each([
    ["umbral negativo", { threshold: -1 }, 0],
    ["umbral mayor que 1", { threshold: 5 }, 1],
  ])("recorta un %s al rango [0,1]", async (_caso, options, esperado) => {
    const { client, rpc } = createSupabaseFake({ data: [], error: null });

    await vectorSearchService.search(client, "scrum", options);

    expect(rpc.mock.calls[0][1].match_threshold).toBe(esperado);
  });

  it("respeta unos valores explícitos dentro de rango", async () => {
    const { client, rpc } = createSupabaseFake({ data: [], error: null });

    await vectorSearchService.search(client, "scrum", { topK: 3, threshold: 0.6 });

    expect(rpc.mock.calls[0][1]).toMatchObject({
      match_count: 3,
      match_threshold: 0.6,
    });
  });
});

describe("groupByArticle", () => {
  it("agrupa los fragmentos de un mismo artículo bajo una entrada", async () => {
    const { client } = createSupabaseFake({
      data: [
        row({ article_id: "art-1", chunk_index: 0, similarity: 0.51 }),
        row({ article_id: "art-1", chunk_index: 2, similarity: 0.45 }),
        row({ article_id: "art-2", chunk_index: 0, similarity: 0.4 }),
      ],
      error: null,
    });

    const { articles } = await vectorSearchService.search(client, "scrum");

    expect(articles).toHaveLength(2);
    expect(articles[0].articleId).toBe("art-1");
    expect(articles[0].chunks).toHaveLength(2);
  });

  it("el score de un artículo es el de su MEJOR fragmento", () => {
    const articles = vectorSearchService.groupByArticle([
      { articleId: "a", title: "A", chunkIndex: 0, content: "x", similarity: 0.9 },
      { articleId: "a", title: "A", chunkIndex: 1, content: "y", similarity: 0.3 },
    ]);

    expect(articles[0].score).toBe(0.9);
  });

  it("ordena los artículos por score descendente", () => {
    const articles = vectorSearchService.groupByArticle([
      { articleId: "a", title: "A", chunkIndex: 0, content: "x", similarity: 0.5 },
      { articleId: "b", title: "B", chunkIndex: 0, content: "y", similarity: 0.8 },
    ]);

    // `groupByArticle` no asume el orden de entrada: reordena por score.
    expect(articles.map((a) => a.articleId)).toEqual(["b", "a"]);
  });

  it("devuelve [] sin fragmentos", () => {
    expect(vectorSearchService.groupByArticle([])).toEqual([]);
  });
});

describe("searchByEmbedding", () => {
  it("busca sin pasar por el proveedor de embeddings", async () => {
    // Existe justamente para poder recuperar con un vector ya calculado (caché,
    // re-ranking) sin depender del proveedor.
    const { client } = createSupabaseFake({ data: [row()], error: null });

    const chunks = await vectorSearchService.searchByEmbedding(client, VECTOR);

    expect(chunks).toHaveLength(1);
    expect(embeddingService.embedQuery).not.toHaveBeenCalled();
  });
});
