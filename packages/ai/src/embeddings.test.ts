import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMBEDDING_DIMENSIONS,
  createEmbedding,
  createEmbeddings,
  toVectorLiteral,
} from "./embeddings";

// ============================================================================
// embeddings — ÚNICO punto del proyecto que conoce a Voyage AI.
//
// `fetch` se sustituye entero: ninguna prueba sale a la red ni gasta cuota. Lo
// que se verifica es NUESTRA lógica alrededor del proveedor —troceado en lotes,
// validación de lo que devuelve, reordenación— porque es justamente lo que
// protege a la base de datos de un vector corrupto.
// ============================================================================

const vector = (n = EMBEDDING_DIMENSIONS) => Array.from({ length: n }, () => 0.1);

/** Respuesta OK del proveedor, con los índices que se le pidan. */
function voyageOk(indices: number[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: indices.map((index) => ({ index, embedding: vector() })),
      model: "voyage-4",
      usage: { total_tokens: 10 },
    }),
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createEmbeddings — comportamiento esperado", () => {
  it("vectoriza un lote y devuelve un vector por texto", async () => {
    fetchMock.mockResolvedValue(voyageOk([0, 1]));

    const embeddings = await createEmbeddings(["uno", "dos"], "document");

    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("envía el input_type que se le pide (query y document se proyectan distinto)", async () => {
    fetchMock.mockResolvedValue(voyageOk([0]));

    await createEmbeddings(["¿qué es scrum?"], "query");

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      input_type: "query",
      model: "voyage-4",
    });
  });

  it("autentica con la clave del servidor", async () => {
    fetchMock.mockResolvedValue(voyageOk([0]));

    await createEmbeddings(["x"], "document");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer test-voyage-key");
  });

  it("REORDENA la respuesta: el proveedor puede devolverla desordenada", async () => {
    // Si no se reordenara por `index`, el fragmento 0 se guardaría con el vector
    // del fragmento 2. La búsqueda semántica devolvería el texto equivocado, y
    // sería un fallo silencioso: nada explotaría.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { index: 1, embedding: vector().map(() => 0.2) },
          { index: 0, embedding: vector().map(() => 0.1) },
        ],
        model: "voyage-4",
        usage: { total_tokens: 4 },
      }),
    });

    const [primero, segundo] = await createEmbeddings(["a", "b"], "document");

    expect(primero[0]).toBe(0.1);
    expect(segundo[0]).toBe(0.2);
  });

  it("trocea en lotes de 96 para no desbordar el payload del proveedor", async () => {
    const textos = Array.from({ length: 100 }, (_, i) => `texto ${i}`);
    fetchMock
      .mockResolvedValueOnce(voyageOk(Array.from({ length: 96 }, (_, i) => i)))
      .mockResolvedValueOnce(voyageOk([0, 1, 2, 3]));

    const embeddings = await createEmbeddings(textos, "document");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(embeddings).toHaveLength(100);
  });

  it("no llama al proveedor con una lista vacía", async () => {
    await expect(createEmbeddings([], "document")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createEmbeddings — manejo de errores del proveedor", () => {
  it.each([
    ["401 (clave inválida)", 401],
    ["429 (límite de ritmo)", 429],
    ["500 (caída del proveedor)", 500],
  ])("lanza ante un %s", async (_caso, status) => {
    fetchMock.mockResolvedValue({ ok: false, status, json: async () => ({}) });

    await expect(createEmbeddings(["x"], "document")).rejects.toThrow(
      `El proveedor de embeddings respondió ${status}.`,
    );
  });

  it("no filtra el cuerpo crudo del proveedor en el mensaje de error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: "api key sk-interna-123 revocada" }),
    });

    await expect(createEmbeddings(["x"], "document")).rejects.toThrow(
      /^El proveedor de embeddings respondió 401\.$/,
    );
  });

  it("propaga un fallo de red", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));

    await expect(createEmbeddings(["x"], "document")).rejects.toThrow("ECONNRESET");
  });
});

describe("createEmbeddings — validación de lo que devuelve el proveedor", () => {
  it("rechaza una respuesta con MENOS vectores que textos", async () => {
    // Persistir esto desalinearía los fragmentos con sus vectores.
    fetchMock.mockResolvedValue(voyageOk([0]));

    await expect(createEmbeddings(["a", "b"], "document")).rejects.toThrow(
      "número de embeddings inesperado",
    );
  });

  it("rechaza una dimensión distinta de la que espera la BD (vector(1024))", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ index: 0, embedding: vector(512) }],
        model: "voyage-4",
        usage: { total_tokens: 1 },
      }),
    });

    await expect(createEmbeddings(["x"], "document")).rejects.toThrow(
      /Dimensión inesperada/,
    );
  });

  it("rechaza un vector con valores no finitos (NaN corrompería la similitud)", async () => {
    const roto = vector();
    roto[5] = Number.NaN;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ index: 0, embedding: roto }],
        model: "voyage-4",
        usage: { total_tokens: 1 },
      }),
    });

    await expect(createEmbeddings(["x"], "document")).rejects.toThrow(
      /valores no finitos/,
    );
  });

  it("rechaza un embedding que no es un array", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ index: 0, embedding: "no soy un vector" }],
        model: "voyage-4",
        usage: { total_tokens: 1 },
      }),
    });

    await expect(createEmbeddings(["x"], "document")).rejects.toThrow(
      /no es un array/,
    );
  });

  it("rechaza una respuesta sin campo data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: "algo raro" }),
    });

    await expect(createEmbeddings(["x"], "document")).rejects.toThrow(
      "Respuesta inválida del proveedor",
    );
  });
});

describe("createEmbedding (singular)", () => {
  it("devuelve un único vector", async () => {
    fetchMock.mockResolvedValue(voyageOk([0]));

    const embedding = await createEmbedding("scrum", "query");

    expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
  });
});

describe("toVectorLiteral", () => {
  it("serializa al literal que espera pgvector", () => {
    expect(toVectorLiteral([0.1, 0.2, -0.3] as never)).toBe("[0.1,0.2,-0.3]");
  });

  it("no introduce espacios (pgvector no los admite en el literal)", () => {
    expect(toVectorLiteral(vector(3) as never)).not.toContain(" ");
  });
});
