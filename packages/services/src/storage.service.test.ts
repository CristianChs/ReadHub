import { describe, expect, it } from "vitest";

import {
  MAX_DOCUMENT_SIZE,
  MAX_IMAGE_SIZE,
  storageService,
} from "./storage.service";

// ============================================================================
// storage.service — validación de tipo y tamaño de archivo. Es un requisito de
// SEGURIDAD de la spec: es la puerta por la que un usuario mete bytes en el
// sistema, así que sus casos límite se prueban uno a uno.
//
// `validateDocument` / `validateImage` / `buildObjectPath` son puras: no tocan
// Supabase. Las que sí lo tocan (upload*, download, remove) no se prueban aquí:
// serían un test de `supabase.storage`, no de ReadHub.
// ============================================================================

/** Crea un File del tamaño pedido sin reservar memoria de verdad. */
function fakeFile(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  // `size` es de solo lectura en File: se redefine para poder probar los límites
  // sin materializar 10 MB en memoria en cada caso.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateDocument", () => {
  it.each([
    ["TXT", "doc.txt", "text/plain"],
    ["PDF", "doc.pdf", "application/pdf"],
    [
      "DOCX",
      "doc.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  ])("acepta un %s válido", (_caso, name, type) => {
    expect(storageService.validateDocument(fakeFile(name, type, 1024))).toBeNull();
  });

  it("acepta por EXTENSIÓN cuando el navegador no reporta el MIME", () => {
    // Caso real: algunos navegadores envían type:"" para .txt o .docx.
    expect(storageService.validateDocument(fakeFile("apuntes.txt", "", 10))).toBeNull();
    expect(storageService.validateDocument(fakeFile("tesis.docx", "", 10))).toBeNull();
  });

  it("acepta la extensión sin importar mayúsculas/minúsculas", () => {
    expect(storageService.validateDocument(fakeFile("TESIS.PDF", "", 10))).toBeNull();
  });

  it.each([
    ["ejecutable", "virus.exe", "application/x-msdownload"],
    ["imagen disfrazada de documento", "foto.png", "image/png"],
    ["sin extensión ni MIME", "archivo", ""],
  ])("rechaza un %s", (_caso, name, type) => {
    expect(storageService.validateDocument(fakeFile(name, type, 10))).toBe(
      "El documento debe tener formato TXT, DOCX o PDF.",
    );
  });

  it("rechaza un documento que supera los 10 MB", () => {
    expect(
      storageService.validateDocument(
        fakeFile("grande.pdf", "application/pdf", MAX_DOCUMENT_SIZE + 1),
      ),
    ).toBe("El documento supera el tamaño máximo de 10 MB.");
  });

  it("acepta un documento EXACTAMENTE en el límite (el tope es inclusivo)", () => {
    expect(
      storageService.validateDocument(
        fakeFile("justo.pdf", "application/pdf", MAX_DOCUMENT_SIZE),
      ),
    ).toBeNull();
  });

  it("valida el TIPO antes que el TAMAÑO", () => {
    // Un .exe de 50 MB debe reportarse como formato inválido, no como "muy grande":
    // el mensaje debe señalar el problema real.
    expect(
      storageService.validateDocument(
        fakeFile("virus.exe", "application/x-msdownload", MAX_DOCUMENT_SIZE * 5),
      ),
    ).toBe("El documento debe tener formato TXT, DOCX o PDF.");
  });

  it("acepta un archivo vacío (0 bytes): el tamaño mínimo no es su responsabilidad", () => {
    expect(storageService.validateDocument(fakeFile("vacio.txt", "text/plain", 0))).toBeNull();
  });
});

describe("validateImage", () => {
  it.each([
    ["PNG", "image/png"],
    ["JPEG", "image/jpeg"],
    ["WEBP", "image/webp"],
    ["GIF", "image/gif"],
  ])("acepta una imagen %s", (_caso, type) => {
    expect(storageService.validateImage(fakeFile("portada", type, 1024))).toBeNull();
  });

  it.each([
    ["un SVG (vector con script embebible)", "image/svg+xml"],
    ["un PDF", "application/pdf"],
    ["un tipo vacío", ""],
  ])("rechaza %s", (_caso, type) => {
    expect(storageService.validateImage(fakeFile("archivo", type, 10))).toBe(
      "La imagen debe ser PNG, JPG, WEBP o GIF.",
    );
  });

  it("NO acepta imágenes por extensión: aquí el MIME es obligatorio", () => {
    // Diferencia deliberada con `validateDocument`: la imagen no tiene fallback.
    expect(storageService.validateImage(fakeFile("portada.png", "", 10))).toBe(
      "La imagen debe ser PNG, JPG, WEBP o GIF.",
    );
  });

  it("rechaza una imagen que supera los 5 MB y acepta la que está justo en el límite", () => {
    expect(
      storageService.validateImage(
        fakeFile("grande.png", "image/png", MAX_IMAGE_SIZE + 1),
      ),
    ).toBe("La imagen supera el tamaño máximo de 5 MB.");

    expect(
      storageService.validateImage(
        fakeFile("justa.png", "image/png", MAX_IMAGE_SIZE),
      ),
    ).toBeNull();
  });
});

describe("buildObjectPath", () => {
  it("prefija la ruta con el id del usuario (aislamiento por dueño)", () => {
    const path = storageService.buildObjectPath(
      "user-123",
      fakeFile("apuntes.pdf", "application/pdf", 10),
    );
    expect(path.startsWith("user-123/")).toBe(true);
  });

  it("un nombre con travesía de directorios no puede escapar del prefijo del usuario", () => {
    const path = storageService.buildObjectPath(
      "user-123",
      fakeFile("../../etc/passwd", "text/plain", 10),
    );

    // La propiedad que importa es que NO QUEDE NINGUNA BARRA salvo la que el
    // propio service introduce: sin separador no hay travesía posible, y el
    // objeto cae necesariamente dentro de la carpeta del usuario.
    //
    // Los puntos sí sobreviven (`.` es un carácter permitido, por las
    // extensiones), así que el nombre acaba siendo "..-..-etc-passwd". Es feo,
    // pero es un nombre de fichero inerte dentro de un único segmento: aserta
    // sobre las barras, que es lo que de verdad protege.
    expect(path.split("/")).toHaveLength(2);
    expect(path.startsWith("user-123/")).toBe(true);
    expect(path).not.toContain("/etc/");
  });

  it("normaliza espacios, acentos y mayúsculas del nombre original", () => {
    const path = storageService.buildObjectPath(
      "u1",
      fakeFile("Mi Tesis Ñoña.PDF", "application/pdf", 10),
    );
    expect(path).toMatch(/^u1\/\d+-[a-z0-9.-]+$/);
  });

  it("genera rutas distintas para el mismo archivo en instantes distintos", async () => {
    const file = fakeFile("a.txt", "text/plain", 10);
    const first = storageService.buildObjectPath("u1", file);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = storageService.buildObjectPath("u1", file);

    // Lleva timestamp justamente para no pisar una subida anterior (upsert:false).
    expect(first).not.toBe(second);
  });

  it("no deja el nombre vacío ni con guiones sueltos en los extremos", () => {
    const path = storageService.buildObjectPath(
      "u1",
      fakeFile("!!!.txt", "text/plain", 10),
    );
    expect(path).not.toMatch(/-$/);
    expect(path).not.toContain("--");
  });
});
