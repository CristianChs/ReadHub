import { describe, expect, it } from "vitest";

import { embeddingService } from "./embedding.service";

// ============================================================================
// embedding.service — funciones utilitarias PURAS del troceado.
//
// El troceado decide la calidad de todo el RAG: un fragmento demasiado grande
// diluye la similitud entre varios temas; uno demasiado pequeño pierde el
// sentido. Y su aritmética de solape es delicada.
//
// `embedArticle` (que sí vectoriza y persiste) no se prueba aquí: su valor está
// en la integración, y sus dos dependencias —el proveedor y la BD— ya están
// cubiertas en sus propios módulos.
// ============================================================================

const { chunkText, buildContextHeader, buildArticleChunks } = embeddingService;

describe("chunkText", () => {
  it("devuelve un único fragmento si el texto cabe entero", () => {
    expect(chunkText("Un párrafo corto y suficiente.")).toEqual([
      "Un párrafo corto y suficiente.",
    ]);
  });

  it.each([
    ["cadena vacía", ""],
    ["solo espacios", "    "],
    ["solo saltos de línea", "\n\n\n"],
  ])("devuelve [] ante %s", (_caso, text) => {
    expect(chunkText(text)).toEqual([]);
  });

  it("respeta los límites de párrafo en vez de cortar a ciegas", () => {
    const chunks = chunkText("Primero.\n\nSegundo.", 12, 2);

    // Cada párrafo cabe por sí solo, pero juntos no: no se parte ninguna frase.
    expect(chunks).toContain("Primero.");
    expect(chunks.some((c) => c.includes("Segundo."))).toBe(true);
  });

  it("agrupa varios párrafos cortos en un mismo fragmento", () => {
    expect(chunkText("Uno.\n\nDos.", 100, 10)).toEqual(["Uno.\n\nDos."]);
  });

  it("parte por tamaño un párrafo más largo que el máximo", () => {
    const chunks = chunkText("a".repeat(250), 100, 20);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(100);
  });

  it("aplica solape al partir un párrafo largo (una idea a caballo sigue siendo recuperable)", () => {
    const chunks = chunkText("abcdefghij".repeat(10), 50, 20);

    // Con solape, el paso es (max - overlap): los fragmentos comparten cola/cabeza.
    const total = chunks.join("").length;
    expect(total).toBeGreaterThan(100); // habría sido = 100 sin solape
  });

  it("NUNCA excede el máximo, ni siquiera al añadir el solape", () => {
    // Caso límite del solape: si el párrafo ya llena el fragmento, la cola del
    // anterior se recorta o se omite. Un fragmento de más de `maxChars` rompería
    // el presupuesto de contexto aguas abajo.
    const texto = ["x".repeat(90), "y".repeat(95), "z".repeat(30)].join("\n\n");

    for (const chunk of chunkText(texto, 100, 40)) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });

  it("normaliza los saltos de línea de Windows", () => {
    expect(chunkText("Uno.\r\n\r\nDos.", 100, 10)).toEqual(["Uno.\n\nDos."]);
  });

  it("no devuelve fragmentos vacíos ni de solo espacios", () => {
    for (const chunk of chunkText("Uno.\n\n\n\n   \n\nDos.", 100, 10)) {
      expect(chunk.trim()).not.toBe("");
    }
  });

  it("sanea la salida: cortar por tamaño puede partir un emoji en dos", () => {
    // `slice` corta por unidades UTF-16. Sin saneado, aquí saldría un sustituto
    // huérfano y Postgres rechazaría la inserción con 22P02.
    const chunks = chunkText(`${"a".repeat(99)}📚${"b".repeat(99)}`, 100, 10);

    for (const chunk of chunks) {
      expect(() => JSON.stringify(chunk)).not.toThrow();
      expect(chunk).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      expect(chunk).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    }
  });
});

describe("buildContextHeader", () => {
  it("incluye título y resumen", () => {
    expect(
      buildContextHeader({ title: "SCRUM Práctico", summary: "Guía breve" }),
    ).toBe("Título: SCRUM Práctico\nResumen: Guía breve");
  });

  it("omite el resumen cuando no hay", () => {
    expect(buildContextHeader({ title: "SCRUM", summary: null })).toBe(
      "Título: SCRUM",
    );
  });

  it("omite un resumen que es solo espacios", () => {
    expect(buildContextHeader({ title: "SCRUM", summary: "   " })).toBe(
      "Título: SCRUM",
    );
  });
});

describe("buildArticleChunks", () => {
  const base = { articleId: "art-1", title: "SCRUM Práctico", summary: "Guía" };

  it("antepone la cabecera a lo que se VECTORIZA, no a lo que se ALMACENA", () => {
    // El título se readjunta en la recuperación (la función SQL ya devuelve
    // `article_title`): duplicarlo en el contenido almacenado desperdiciaría
    // tokens de contexto en cada respuesta.
    const [chunk] = buildArticleChunks({
      ...base,
      content: "El sprint es una iteración.",
    });

    expect(chunk.stored).toBe("El sprint es una iteración.");
    expect(chunk.embedded).toContain("Título: SCRUM Práctico");
    expect(chunk.embedded).toContain("El sprint es una iteración.");
  });

  it.each([
    ["contenido null", null],
    ["contenido vacío", ""],
    ["contenido en blanco", "   "],
  ])(
    "indexa el artículo por su metadata cuando el documento no es legible (%s)",
    (_caso, content) => {
      // Un PDF ilegible no debe dejar el artículo invisible para el asistente:
      // sigue siendo recuperable por su título y resumen.
      const chunks = buildArticleChunks({ ...base, content });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].stored).toBe("Título: SCRUM Práctico\nResumen: Guía");
    },
  );

  it("todos los fragmentos de un artículo largo llevan la misma cabecera", () => {
    // Es lo que ancla semánticamente un fragmento tomado del centro del PDF: sin
    // la cabecera, un trozo que nunca menciona "SCRUM" no se recuperaría al
    // preguntar por SCRUM.
    const chunks = buildArticleChunks({
      ...base,
      content: Array.from({ length: 8 }, (_, i) => `Párrafo ${i}. ${"x".repeat(300)}`).join(
        "\n\n",
      ),
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.embedded.startsWith("Título: SCRUM Práctico")).toBe(true);
    }
  });
});
