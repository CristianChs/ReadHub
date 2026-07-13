import { sanitizeText } from "./sanitize";

// ============================================================================
// Extracción de texto plano a partir del documento de un artículo.
//
// SOLO SERVIDOR: `unpdf` y `mammoth` son librerías de Node y no deben entrar
// en el bundle del navegador. Se importan de forma dinámica para que Next no
// las incluya salvo cuando realmente se usan.
//
// Es la pieza que alimenta el pipeline de indexación: sin ella, un artículo en
// PDF no tiene texto que vectorizar.
// ============================================================================

/** Formatos que el formulario de publicación acepta (ver storage.service). */
export type DocumentFormat = "txt" | "pdf" | "docx";

export function detectDocumentFormat(path: string): DocumentFormat | null {
  const clean = path.split("?")[0].toLowerCase();
  if (clean.endsWith(".txt")) return "txt";
  if (clean.endsWith(".pdf")) return "pdf";
  if (clean.endsWith(".docx")) return "docx";
  return null;
}

/**
 * Normaliza el texto extraído: saltos coherentes y sin ruido de paginación.
 *
 * `sanitizeText` se aplica primero: los PDF reales traen NUL y sustitutos
 * UTF-16 sueltos que ni JSON ni Postgres admiten.
 */
export function normalizeExtractedText(raw: string): string {
  return sanitizeText(raw)
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ") // espacio duro
    .replace(/[ \t]+/g, " ") // colapsa espacios
    .replace(/ ?\n ?/g, "\n") // limpia espacios alrededor de saltos
    .replace(/\n{3,}/g, "\n\n") // máximo una línea en blanco
    .trim();
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");

  // pdf.js toma posesión del buffer y lo deja "detached": se le pasa una copia
  // para que el llamador conserve sus bytes utilizables.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));

  // `mergePages: false` devuelve el texto por página. Unir las páginas con una
  // línea en blanco convierte el salto de página en frontera de párrafo, que es
  // la señal que usa chunkText para no cortar a ciegas por tamaño.
  const { text } = await extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(bytes),
  });
  return value;
}

function extractTxt(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Convierte los bytes de un documento en texto plano listo para vectorizar.
 * Devuelve null si el formato no es soportado o el documento no tiene texto
 * (p. ej. un PDF escaneado, que sería solo imágenes).
 */
export async function extractDocumentText(
  bytes: Uint8Array,
  path: string,
): Promise<string | null> {
  const format = detectDocumentFormat(path);
  if (!format) return null;

  let raw: string;
  switch (format) {
    case "pdf":
      raw = await extractPdf(bytes);
      break;
    case "docx":
      raw = await extractDocx(bytes);
      break;
    case "txt":
      raw = extractTxt(bytes);
      break;
  }

  const text = normalizeExtractedText(raw);
  return text.length > 0 ? text : null;
}
