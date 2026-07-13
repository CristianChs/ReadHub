import { describe, expect, it } from "vitest";

import {
  cosineSimilarity,
  documentFrequencies,
  termFrequencies,
  tfidfKeywords,
  tokenize,
  topTerms,
  wordCount,
} from "./analysis";

// ============================================================================
// analysis — base del análisis multi-documento del servidor MCP. Puro y
// determinista: sin red, sin embeddings, sin claves.
// ============================================================================

describe("tokenize", () => {
  it("normaliza a minúsculas y quita tildes", () => {
    expect(tokenize("Metodologías ÁGILES")).toEqual(["metodologias", "agiles"]);
  });

  it("descarta las palabras vacías", () => {
    expect(tokenize("el sprint y la revisión")).toEqual(["sprint", "revision"]);
  });

  it("descarta las palabras vacías CON TILDE aunque el token llegue sin ella", () => {
    // Regresión: `tokenize` quita las tildes antes de comparar, así que la lista
    // de stopwords tiene que estar normalizada igual. Si no, "más" -> "mas" se
    // colaba como si fuera un término con carga semántica.
    expect(tokenize("más rápido que ágil")).toEqual(["rapido", "agil"]);
    expect(tokenize("está sobre el código")).toEqual(["codigo"]);
  });

  it("descarta tokens de menos de 3 caracteres", () => {
    expect(tokenize("un ok si backlog")).toEqual(["backlog"]);
  });

  it("descarta los números puros pero conserva los alfanuméricos", () => {
    expect(tokenize("sprint 2026 scrum3")).toEqual(["sprint", "scrum3"]);
  });

  it("trata la puntuación como separador", () => {
    expect(tokenize("scrum,kanban;xp")).toEqual(["scrum", "kanban"]);
  });

  it.each([
    ["cadena vacía", ""],
    ["solo espacios", "   "],
    ["solo puntuación", "-- ,.;"],
    ["solo palabras vacías", "el la de que"],
  ])("devuelve [] ante %s", (_caso, text) => {
    expect(tokenize(text)).toEqual([]);
  });
});

describe("termFrequencies / topTerms", () => {
  it("cuenta las apariciones de cada término", () => {
    const tf = termFrequencies(["scrum", "sprint", "scrum"]);
    expect(tf.get("scrum")).toBe(2);
    expect(tf.get("sprint")).toBe(1);
  });

  it("devuelve un vector vacío ante una lista vacía", () => {
    expect(termFrequencies([]).size).toBe(0);
  });

  it("ordena por frecuencia descendente y recorta a n", () => {
    const tf = termFrequencies(["a", "a", "a", "b", "b", "c"]);
    expect(topTerms(tf, 2)).toEqual([
      { term: "a", count: 3 },
      { term: "b", count: 2 },
    ]);
  });

  it("desempata alfabéticamente (resultado determinista)", () => {
    const tf = termFrequencies(["zeta", "alfa"]); // ambos con count 1
    expect(topTerms(tf, 2).map((t) => t.term)).toEqual(["alfa", "zeta"]);
  });

  it("no falla si se piden más términos de los que hay", () => {
    expect(topTerms(termFrequencies(["uno"]), 10)).toHaveLength(1);
  });

  it("devuelve [] si se piden 0 términos", () => {
    expect(topTerms(termFrequencies(["uno"]), 0)).toEqual([]);
  });
});

describe("cosineSimilarity", () => {
  it("da 1 con vectores idénticos", () => {
    const v = termFrequencies(["scrum", "sprint", "scrum"]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10);
  });

  it("da 1 con las mismas proporciones aunque cambie la escala", () => {
    // El coseno mide dirección, no magnitud: un documento el doble de largo pero
    // con el mismo vocabulario en la misma proporción es igual de similar.
    const a = termFrequencies(["scrum", "sprint"]);
    const b = termFrequencies(["scrum", "scrum", "sprint", "sprint"]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 10);
  });

  it("da 0 sin términos en común", () => {
    expect(
      cosineSimilarity(
        termFrequencies(["scrum"]),
        termFrequencies(["estadistica"]),
      ),
    ).toBe(0);
  });

  it("da un valor intermedio con solapamiento parcial", () => {
    const sim = cosineSimilarity(
      termFrequencies(["scrum", "sprint"]),
      termFrequencies(["scrum", "kanban"]),
    );
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it("es simétrica", () => {
    const a = termFrequencies(["scrum", "sprint", "sprint"]);
    const b = termFrequencies(["scrum", "kanban"]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it("da 0 si algún vector está vacío (no divide entre cero)", () => {
    const vacio = termFrequencies([]);
    const lleno = termFrequencies(["scrum"]);
    expect(cosineSimilarity(vacio, lleno)).toBe(0);
    expect(cosineSimilarity(lleno, vacio)).toBe(0);
    expect(cosineSimilarity(vacio, vacio)).toBe(0);
  });

  it("nunca se sale del rango [0, 1]", () => {
    const a = termFrequencies(tokenize("scrum sprint backlog scrum"));
    const b = termFrequencies(tokenize("backlog producto scrum"));
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThanOrEqual(0);
    expect(sim).toBeLessThanOrEqual(1);
  });
});

describe("documentFrequencies", () => {
  it("cuenta en cuántos DOCUMENTOS aparece cada término, no cuántas veces", () => {
    const df = documentFrequencies([
      termFrequencies(["scrum", "scrum", "scrum"]), // 3 veces, 1 documento
      termFrequencies(["scrum", "kanban"]),
    ]);
    expect(df.get("scrum")).toBe(2);
    expect(df.get("kanban")).toBe(1);
  });

  it("devuelve un mapa vacío ante un corpus vacío", () => {
    expect(documentFrequencies([]).size).toBe(0);
  });
});

describe("tfidfKeywords", () => {
  it("a igual frecuencia, gana el término RARO en el corpus (el distintivo)", () => {
    // "scrum" aparece en los 3 documentos: es común, no distingue.
    // "retrospectiva" solo en este: es lo que hace único al documento.
    // Con la misma TF, la desigualdad la decide el IDF, que es el punto del método.
    const doc = termFrequencies(["scrum", "retrospectiva"]);
    const df = new Map([
      ["scrum", 3],
      ["retrospectiva", 1],
    ]);

    const [primero] = tfidfKeywords(doc, df, 3, 2);

    expect(primero.term).toBe("retrospectiva");
  });

  it("pero la FRECUENCIA sigue pesando: es TF-IDF, no solo IDF", () => {
    // Un término común repetido muchas veces puede superar a uno raro y aislado,
    // y debe hacerlo: si el documento habla constantemente de scrum, scrum ES su
    // tema aunque el resto del corpus también lo mencione.
    const doc = termFrequencies(["scrum", "scrum", "scrum", "retrospectiva"]);
    const df = new Map([
      ["scrum", 3],
      ["retrospectiva", 1],
    ]);

    const [primero] = tfidfKeywords(doc, df, 3, 2);

    expect(primero.term).toBe("scrum");
  });

  it("recorta a n resultados", () => {
    const doc = termFrequencies(["a", "b", "c", "d"]);
    expect(tfidfKeywords(doc, new Map(), 4, 2)).toHaveLength(2);
  });

  it("no falla con un término ausente del mapa de frecuencias", () => {
    // Caso límite: df vacío -> se asume docFreq = 1 en vez de dividir entre 0.
    const scores = tfidfKeywords(termFrequencies(["huerfano"]), new Map(), 5, 1);
    expect(scores[0].score).toBeGreaterThan(0);
    expect(Number.isFinite(scores[0].score)).toBe(true);
  });

  it("devuelve [] ante un documento vacío", () => {
    expect(tfidfKeywords(termFrequencies([]), new Map(), 3, 5)).toEqual([]);
  });
});

describe("wordCount", () => {
  it("cuenta los tokens significativos, no los caracteres", () => {
    expect(wordCount(tokenize("el sprint de scrum"))).toBe(2);
    expect(wordCount([])).toBe(0);
  });
});
