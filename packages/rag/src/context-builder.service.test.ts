import { describe, expect, it } from "vitest";
import { NO_CONTEXT_ANSWER, SYSTEM_PROMPT } from "@readhub/ai";
import type { RetrievedChunk } from "@readhub/types";

import {
  CHARS_PER_TOKEN,
  DEFAULT_MAX_DOCUMENTS,
  DEFAULT_MIN_SIMILARITY,
  contextBuilderService,
} from "./context-builder.service";

// ============================================================================
// context-builder.service — el módulo con más lógica de negocio del proyecto y,
// a la vez, una función PURA: mismos fragmentos de entrada => mismo prompt.
// Ni red, ni Supabase, ni proveedor de IA. Cero mocks.
//
// Es la puerta que decide qué ve el modelo. De sus cinco causas de descarte
// depende que el asistente no alucine (umbral), no repita (redundancia) y no se
// desborde (presupuesto). Cada una se prueba por separado.
// ============================================================================

/** Texto con suficientes letras reales para pasar el filtro de calidad. */
const texto = (semilla: string) =>
  `${semilla} contenido suficientemente largo para superar el minimo de letras.`;

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    articleId: "art-1",
    title: "SCRUM Práctico",
    chunkIndex: 0,
    content: texto("scrum sprint backlog"),
    similarity: 0.8,
    ...overrides,
  };
}

const { buildContext, selectDocuments, buildSources } = contextBuilderService;

describe("buildContext — entradas inválidas", () => {
  it.each([
    ["vacía", ""],
    ["solo espacios", "   "],
    ["solo saltos de línea", "\n\n"],
  ])("lanza ante una consulta %s", (_caso, query) => {
    expect(() => buildContext(query, [chunk()])).toThrow(
      "La consulta no puede estar vacía.",
    );
  });

  it("recorta la consulta antes de usarla", () => {
    expect(buildContext("  ¿qué es scrum?  ", []).query).toBe("¿qué es scrum?");
  });
});

describe("buildContext — sin contexto (la garantía anti-alucinación)", () => {
  it("marca hasContext=false cuando no llega ningún fragmento", () => {
    const context = buildContext("¿qué es scrum?", []);

    expect(context.hasContext).toBe(false);
    expect(context.documents).toEqual([]);
    expect(context.sources).toEqual([]);
    expect(context.stats.chunksRetrieved).toBe(0);
  });

  it("marca hasContext=false si TODOS los fragmentos quedan descartados", () => {
    // Llegaron fragmentos, pero ninguno merecía entrar: es equivalente a no tener
    // nada. Si esto devolviera `true`, el modelo recibiría un contexto vacío y
    // respondería a ciegas: justo lo que el cortocircuito existe para evitar.
    const context = buildContext("¿qué es scrum?", [
      chunk({ similarity: 0.1 }),
    ]);

    expect(context.hasContext).toBe(false);
    expect(context.stats.chunksRetrieved).toBe(1);
    expect(context.stats.chunksSelected).toBe(0);
    expect(context.stats.dropped.belowThreshold).toBe(1);
  });

  it("el prompt sin contexto instruye la respuesta canónica", () => {
    const context = buildContext("¿qué es scrum?", []);

    expect(context.userPrompt).toContain(NO_CONTEXT_ANSWER);
    expect(context.systemPrompt).toBe(SYSTEM_PROMPT);
  });
});

describe("selectDocuments — causa de descarte 1: relevancia (umbral)", () => {
  it("el umbral por defecto es 0.3 (valor calibrado con consultas reales)", () => {
    // Regresión de una decisión medida, no de gusto: con voyage-4 los aciertos
    // genuinos caen en ~0.42-0.51 para la consulta escueta, pero al envolverla en
    // lenguaje natural la similitud baja varias décimas. Con 0.4, consultas
    // legítimas se quedaban sin contexto. Subir este número vuelve a romperlas.
    expect(DEFAULT_MIN_SIMILARITY).toBe(0.3);
  });

  it("descarta lo que está por debajo del umbral y conserva lo que está por encima", () => {
    const { documents, dropped } = selectDocuments(
      [
        chunk({ chunkIndex: 0, similarity: 0.51 }),
        chunk({ chunkIndex: 1, similarity: 0.29 }),
      ],
      opciones(),
    );

    expect(documents).toHaveLength(1);
    expect(documents[0].chunkIndex).toBe(0);
    expect(dropped.belowThreshold).toBe(1);
  });

  it("acepta un fragmento EXACTAMENTE en el umbral (la comparación es <, no <=)", () => {
    const { documents } = selectDocuments(
      [chunk({ similarity: 0.3 })],
      opciones(),
    );
    expect(documents).toHaveLength(1);
  });

  it("respeta un umbral explícito por encima del defecto", () => {
    const { documents, dropped } = selectDocuments(
      [chunk({ similarity: 0.35 })],
      opciones({ minSimilarity: 0.5 }),
    );

    expect(documents).toHaveLength(0);
    expect(dropped.belowThreshold).toBe(1);
  });
});

describe("selectDocuments — causa de descarte 2: calidad", () => {
  it.each([
    ["números de página", "12"],
    ["cabecera suelta", "— 3 —"],
    ["texto vacío", ""],
    ["solo símbolos", "····› ‹····"],
  ])("descarta un fragmento sin texto útil (%s)", (_caso, content) => {
    const { documents, dropped } = selectDocuments(
      [chunk({ content })],
      opciones(),
    );

    expect(documents).toHaveLength(0);
    expect(dropped.lowQuality).toBe(1);
  });

  it("cuenta LETRAS, no caracteres: un fragmento corto pero con palabras entra", () => {
    // 25 letras es el mínimo; los dígitos y signos no suman.
    const { documents } = selectDocuments(
      [chunk({ content: "El sprint dura dos semanas exactas." })],
      opciones(),
    );
    expect(documents).toHaveLength(1);
  });

  it("un fragmento de puros dígitos no pasa, por largo que sea", () => {
    const { dropped } = selectDocuments(
      [chunk({ content: "1234567890 ".repeat(20) })],
      opciones(),
    );
    expect(dropped.lowQuality).toBe(1);
  });
});

describe("selectDocuments — causa de descarte 3: redundancia", () => {
  it("descarta un fragmento cuyo vocabulario ya está cubierto por otro", () => {
    // El solape de 150 caracteres entre fragmentos hace que esto pase de verdad:
    // sin este filtro, el modelo leería dos veces lo mismo y gastaría contexto.
    const base = texto("scrum sprint backlog retrospectiva planificacion equipo");

    const { documents, dropped } = selectDocuments(
      [
        chunk({ chunkIndex: 0, similarity: 0.9, content: base }),
        chunk({ chunkIndex: 1, similarity: 0.8, content: base }),
      ],
      opciones(),
    );

    expect(documents).toHaveLength(1);
    expect(dropped.redundant).toBe(1);
  });

  it("la cobertura es DIRIGIDA: un fragmento largo que contiene a uno corto SÍ entra", () => {
    // Esta es la razón de no usar Jaccard. El segundo fragmento repite todo el
    // primero pero añade mucho material nuevo: aporta información y debe entrar.
    // Jaccard lo penalizaría por la diferencia de tamaño; la cobertura no.
    const corto = "El sprint dura dos semanas exactas siempre.";
    const largo = `${corto} ${texto(
      "retrospectiva planificacion revision incremento producto kanban metricas velocidad",
    )}`;

    const { documents, dropped } = selectDocuments(
      [
        chunk({ chunkIndex: 0, similarity: 0.9, content: corto }),
        chunk({ chunkIndex: 1, similarity: 0.8, content: largo }),
      ],
      opciones(),
    );

    expect(documents).toHaveLength(2);
    expect(dropped.redundant).toBe(0);
  });

  it("no marca como redundantes dos fragmentos de temas distintos", () => {
    const { documents, dropped } = selectDocuments(
      [
        chunk({ chunkIndex: 0, content: texto("scrum sprint backlog agil") }),
        chunk({
          chunkIndex: 1,
          content: texto("estadistica varianza mediana histograma"),
        }),
      ],
      opciones(),
    );

    expect(documents).toHaveLength(2);
    expect(dropped.redundant).toBe(0);
  });
});

describe("selectDocuments — causa de descarte 4: tope de documentos", () => {
  it("no supera el máximo y contabiliza el resto", () => {
    const chunks = Array.from({ length: 7 }, (_, i) =>
      chunk({
        chunkIndex: i,
        similarity: 0.9 - i * 0.05,
        content: texto(`tema${i} distinto${i} vocabulario${i} propio${i}`),
      }),
    );

    const { documents, dropped } = selectDocuments(chunks, opciones());

    expect(documents).toHaveLength(DEFAULT_MAX_DOCUMENTS);
    expect(dropped.overMaxDocuments).toBe(7 - DEFAULT_MAX_DOCUMENTS);
  });

  it("conserva los MÁS relevantes: los fragmentos llegan ya ordenados", () => {
    const chunks = Array.from({ length: 6 }, (_, i) =>
      chunk({
        chunkIndex: i,
        similarity: 0.9 - i * 0.05,
        content: texto(`tema${i} distinto${i} vocabulario${i} propio${i}`),
      }),
    );

    const { documents } = selectDocuments(chunks, opciones());

    expect(documents.map((d) => d.chunkIndex)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("selectDocuments — causa de descarte 5: presupuesto de contexto", () => {
  it("no admite un fragmento que no cabe en el presupuesto", () => {
    const grande = "a".repeat(500);

    const { documents, dropped, charsUsed } = selectDocuments(
      [chunk({ content: grande })],
      opciones({ tokenBudget: 100 }), // 100 * 4 = 400 caracteres
    );

    expect(documents).toHaveLength(0);
    expect(dropped.overBudget).toBe(1);
    expect(charsUsed).toBe(0);
  });

  it("NO trunca a mitad de un fragmento: lo salta entero", () => {
    // Truncar dejaría una frase mutilada que el modelo podría malinterpretar.
    const { documents } = selectDocuments(
      [chunk({ content: "b".repeat(500) })],
      opciones({ tokenBudget: 100 }),
    );

    expect(documents).toHaveLength(0);
  });

  it("sigue evaluando: un fragmento posterior más pequeño SÍ puede caber", () => {
    // El bucle hace `continue`, no `break`. Un fragmento menos relevante pero
    // corto aprovecha el hueco que dejó el que no cabía.
    const { documents, dropped } = selectDocuments(
      [
        chunk({ chunkIndex: 0, similarity: 0.9, content: "z".repeat(500) }),
        chunk({
          chunkIndex: 1,
          similarity: 0.5,
          content: texto("scrum sprint corto"),
        }),
      ],
      opciones({ tokenBudget: 100 }),
    );

    expect(dropped.overBudget).toBe(1);
    expect(documents).toHaveLength(1);
    expect(documents[0].chunkIndex).toBe(1);
  });

  it("contabiliza los caracteres consumidos y el presupuesto en caracteres", () => {
    const content = texto("scrum sprint backlog");

    const { charsUsed } = selectDocuments([chunk({ content })], opciones());

    expect(charsUsed).toBe(content.length);
    expect(buildContext("q", [chunk({ content })]).stats.charBudget).toBe(
      2000 * CHARS_PER_TOKEN,
    );
  });
});

describe("selectDocuments — ranking", () => {
  it("numera los documentos de 1 en adelante, sin huecos pese a los descartes", () => {
    // El rank es el número de cita [n] que verá el usuario: un hueco rompería la
    // correspondencia entre la respuesta y la lista de fuentes.
    const { documents } = selectDocuments(
      [
        chunk({ chunkIndex: 0, similarity: 0.9, content: texto("alfa uno") }),
        chunk({ chunkIndex: 1, similarity: 0.1 }), // descartado por umbral
        chunk({ chunkIndex: 2, similarity: 0.8, content: texto("beta dos") }),
      ],
      opciones(),
    );

    expect(documents.map((d) => d.rank)).toEqual([1, 2]);
  });
});

describe("buildSources — agrupación por artículo", () => {
  it("un artículo con varios fragmentos produce UNA sola fuente", () => {
    const context = buildContext("scrum", [
      chunk({ articleId: "art-1", chunkIndex: 0, similarity: 0.9, content: texto("alfa") }),
      chunk({ articleId: "art-1", chunkIndex: 3, similarity: 0.7, content: texto("beta gamma") }),
    ]);

    expect(context.documents).toHaveLength(2);
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].chunkIndexes).toEqual([0, 3]);
  });

  it("la fuente hereda el rank y la similitud de su MEJOR fragmento", () => {
    const sources = buildSources([
      { rank: 1, articleId: "art-1", title: "T", chunkIndex: 0, content: "c", similarity: 0.9 },
      { rank: 2, articleId: "art-1", title: "T", chunkIndex: 1, content: "c", similarity: 0.4 },
    ]);

    expect(sources[0].similarity).toBe(0.9);
    expect(sources[0].rank).toBe(1);
  });

  it("ordena las fuentes por rank y construye la URL de navegación", () => {
    const context = buildContext("scrum", [
      chunk({ articleId: "art-1", similarity: 0.9, content: texto("alfa uno") }),
      chunk({ articleId: "art-2", similarity: 0.6, content: texto("beta dos") }),
    ]);

    expect(context.sources.map((s) => s.articleId)).toEqual(["art-1", "art-2"]);
    expect(context.sources[0].url).toBe("/article/art-1");
  });

  it("devuelve [] sin documentos", () => {
    expect(buildSources([])).toEqual([]);
  });
});

describe("buildContext — el prompt resultante", () => {
  it("incluye el contenido de cada documento y la pregunta", () => {
    const context = buildContext("¿qué es un sprint?", [
      chunk({ content: texto("el sprint es una iteracion") }),
    ]);

    expect(context.hasContext).toBe(true);
    expect(context.userPrompt).toContain("el sprint es una iteracion");
    expect(context.userPrompt).toContain("¿qué es un sprint?");
    expect(context.systemPrompt).toBe(SYSTEM_PROMPT);
  });

  it("es determinista: la misma entrada produce el mismo prompt", () => {
    const chunks = [chunk()];
    expect(buildContext("scrum", chunks)).toEqual(buildContext("scrum", chunks));
  });
});

/** Opciones resueltas, como las construye internamente el service. */
function opciones(
  overrides: Partial<{
    minSimilarity: number;
    maxDocuments: number;
    tokenBudget: number;
    redundancyThreshold: number;
  }> = {},
) {
  return {
    minSimilarity: DEFAULT_MIN_SIMILARITY,
    maxDocuments: DEFAULT_MAX_DOCUMENTS,
    tokenBudget: 2000,
    redundancyThreshold: 0.85,
    ...overrides,
  };
}
