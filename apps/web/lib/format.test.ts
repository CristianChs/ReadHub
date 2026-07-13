// @vitest-environment node
import { describe, expect, it } from "vitest";

import { formatCount, formatDate, getInitials } from "./format";

// ============================================================================
// lib/format — utilidades de presentación. Puras, pero las consume toda la UI:
// una excepción aquí tumba la tarjeta de un artículo entero.
//
// No se asertan las cadenas exactas del Intl (dependen de la versión de ICU del
// runtime y harían el test frágil sin medir nada útil): se asertan los CONTRATOS
// —no lanza, no devuelve "Invalid Date", recorta a 2 iniciales—.
// ============================================================================

describe("formatDate", () => {
  it("formatea una fecha ISO en español", () => {
    const result = formatDate("2026-07-13T10:00:00.000Z");
    expect(result).toContain("2026");
    expect(result).not.toBe("");
  });

  it("acepta un objeto Date igual que una cadena", () => {
    const iso = "2026-07-13T10:00:00.000Z";
    expect(formatDate(new Date(iso))).toBe(formatDate(iso));
  });

  it.each([
    ["cadena sin sentido", "no-soy-una-fecha"],
    ["cadena vacía", ""],
    ["fecha imposible", "2026-13-45"],
  ])("devuelve cadena vacía ante una %s, en vez de 'Invalid Date'", (_c, value) => {
    expect(formatDate(value)).toBe("");
  });

  it("devuelve cadena vacía ante un Date inválido", () => {
    expect(formatDate(new Date("x"))).toBe("");
  });
});

describe("formatCount", () => {
  it("formatea un contador normal", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(42)).toBe("42");
  });

  it("compacta los números grandes", () => {
    // Notación compacta: el resultado es más corto que los 7 dígitos crudos.
    expect(formatCount(1_500_000).length).toBeLessThan(7);
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ])("devuelve '0' ante %s (nunca 'NaN' en pantalla)", (_c, value) => {
    expect(formatCount(value)).toBe("0");
  });
});

describe("getInitials", () => {
  it("toma la inicial de las dos primeras palabras", () => {
    expect(getInitials("Ana María Pérez")).toBe("AM");
  });

  it("usa solo la parte local de un correo", () => {
    expect(getInitials("ana.perez@readhub.dev")).toBe("AP");
  });

  it.each([
    ["separado por puntos", "ana.perez"],
    ["separado por guiones bajos", "ana_perez"],
    ["separado por guiones", "ana-perez"],
  ])("parte el nombre %s", (_c, name) => {
    expect(getInitials(name)).toBe("AP");
  });

  it("devuelve una sola inicial si hay una sola palabra", () => {
    expect(getInitials("demo")).toBe("D");
  });

  it.each([
    ["cadena vacía", ""],
    ["solo espacios", "   "],
    ["solo separadores", "..__--"],
  ])("devuelve '?' ante %s en vez de una cadena vacía", (_c, name) => {
    expect(getInitials(name)).toBe("?");
  });

  it("nunca devuelve más de 2 iniciales", () => {
    expect(getInitials("Juan Carlos de la Vega Ruiz")).toHaveLength(2);
  });
});
