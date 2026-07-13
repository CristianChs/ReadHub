import type { Embedding, EmbeddingInputType } from "@readhub/types";

// ============================================================================
// Cliente del proveedor de embeddings — ÚNICO punto del proyecto que conoce a
// Voyage AI. Cambiar de proveedor implica reescribir solo este archivo, sin
// tocar services, hooks ni componentes.
//
// La generación (LLM) y los embeddings usan proveedores distintos: Groq no
// ofrece embeddings, así que estos se generan con Voyage AI. Ambos son
// independientes y viven detrás de este paquete.
//
// SOLO SERVIDOR: usa VOYAGE_API_KEY, que nunca debe llegar al navegador
// (no lleva prefijo NEXT_PUBLIC_).
// ============================================================================

export const EMBEDDING_MODEL = "voyage-4";

/** Dimensión por defecto de voyage-4. Debe coincidir con vector(1024) en la BD. */
export const EMBEDDING_DIMENSIONS = 1024;

/** Límite de textos por petición, para no exceder el payload del proveedor. */
const MAX_BATCH_SIZE = 96;

const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings";

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage: { total_tokens: number };
}

function getApiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      "Falta VOYAGE_API_KEY. Define la variable de entorno en el servidor " +
        "(sin prefijo NEXT_PUBLIC_).",
    );
  }
  return key;
}

/** Comprueba que el vector recibido es utilizable antes de persistirlo. */
function assertValidEmbedding(embedding: unknown, index: number): Embedding {
  if (!Array.isArray(embedding)) {
    throw new Error(`El embedding ${index} no es un array.`);
  }
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Dimensión inesperada en el embedding ${index}: ` +
        `${embedding.length} (se esperaban ${EMBEDDING_DIMENSIONS}).`,
    );
  }
  if (!embedding.every((n) => typeof n === "number" && Number.isFinite(n))) {
    throw new Error(`El embedding ${index} contiene valores no finitos.`);
  }
  return embedding as Embedding;
}

async function requestBatch(
  texts: string[],
  inputType: EmbeddingInputType,
): Promise<Embedding[]> {
  const response = await fetch(VOYAGE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: EMBEDDING_MODEL,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    // No se expone el cuerpo crudo del proveedor: podría filtrar detalles internos.
    throw new Error(
      `El proveedor de embeddings respondió ${response.status}.`,
    );
  }

  const payload = (await response.json()) as VoyageResponse;

  if (!payload?.data || payload.data.length !== texts.length) {
    throw new Error(
      "Respuesta inválida del proveedor: número de embeddings inesperado.",
    );
  }

  // El proveedor puede devolver los resultados desordenados: se reordenan por `index`.
  const ordered = [...payload.data].sort((a, b) => a.index - b.index);
  return ordered.map((item, i) => assertValidEmbedding(item.embedding, i));
}

/**
 * Vectoriza uno o varios textos. Trocea en lotes para respetar los límites
 * del proveedor y devuelve los vectores en el mismo orden que la entrada.
 */
export async function createEmbeddings(
  texts: string[],
  inputType: EmbeddingInputType,
): Promise<Embedding[]> {
  if (texts.length === 0) return [];

  const results: Embedding[] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    results.push(...(await requestBatch(batch, inputType)));
  }
  return results;
}

/** Atajo para vectorizar un único texto. */
export async function createEmbedding(
  text: string,
  inputType: EmbeddingInputType,
): Promise<Embedding> {
  const [embedding] = await createEmbeddings([text], inputType);
  return embedding;
}

/**
 * Serializa un vector al literal que espera pgvector: "[0.1,0.2,...]".
 * JSON.stringify de un number[] produce exactamente ese formato.
 */
export function toVectorLiteral(embedding: Embedding): string {
  return JSON.stringify(embedding);
}
