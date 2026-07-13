import type { TypedSupabaseClient } from "@readhub/database";

// ============================================================================
// storage.service — única puerta de entrada a Supabase Storage.
// Incluye validación de tipo/tamaño (requisito de seguridad de la spec) antes
// de subir cualquier archivo.
// ============================================================================

// Nombres de los buckets. IMPORTANTE: estos buckets deben existir en Supabase
// Storage (con sus políticas) para que la carga funcione. Ver nota al final.
export const DOCUMENTS_BUCKET = "documents";
export const IMAGES_BUCKET = "images";

// Límites de tamaño.
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

// Formatos permitidos (spec: documento TXT, DOCX o PDF; imagen de portada).
export const ALLOWED_DOCUMENT_TYPES = [
  "text/plain",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [".txt", ".pdf", ".docx"] as const;

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

function hasAllowedExtension(fileName: string, extensions: readonly string[]) {
  const lower = fileName.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

/** Valida un documento. Devuelve un mensaje de error o null si es válido. */
function validateDocument(file: File): string | null {
  const typeOk =
    (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.type) ||
    // Algunos navegadores no reportan el MIME de .txt/.docx: caemos a la extensión.
    hasAllowedExtension(file.name, ALLOWED_DOCUMENT_EXTENSIONS);
  if (!typeOk) {
    return "El documento debe tener formato TXT, DOCX o PDF.";
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return "El documento supera el tamaño máximo de 10 MB.";
  }
  return null;
}

/** Valida una imagen de portada. Devuelve un mensaje de error o null. */
function validateImage(file: File): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "La imagen debe ser PNG, JPG, WEBP o GIF.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "La imagen supera el tamaño máximo de 5 MB.";
  }
  return null;
}

// Construye una ruta única y estable dentro del bucket: <userId>/<timestamp>-<nombre>.
function buildObjectPath(userId: string, file: File): string {
  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${userId}/${Date.now()}-${safeName}`;
}

// Sube un archivo a un bucket y devuelve la ruta almacenada.
async function upload(
  supabase: TypedSupabaseClient,
  bucket: string,
  path: string,
  file: File,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return data.path;
}

async function uploadDocument(
  supabase: TypedSupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  return upload(supabase, DOCUMENTS_BUCKET, buildObjectPath(userId, file), file);
}

async function uploadImage(
  supabase: TypedSupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  return upload(supabase, IMAGES_BUCKET, buildObjectPath(userId, file), file);
}

// URL pública de un objeto (para mostrar portadas / descargar documentos).
function getPublicUrl(
  supabase: TypedSupabaseClient,
  bucket: string,
  path: string,
): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Descarga los bytes de un documento. Lo consume el pipeline de indexación
// para extraer el texto que se vectoriza.
async function downloadDocument(
  supabase: TypedSupabaseClient,
  path: string,
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

async function remove(
  supabase: TypedSupabaseClient,
  bucket: string,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export const storageService = {
  validateDocument,
  validateImage,
  buildObjectPath,
  uploadDocument,
  uploadImage,
  getPublicUrl,
  downloadDocument,
  remove,
};
