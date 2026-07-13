// ============================================================================
// Análisis léxico de texto. Funciones PURAS y deterministas: no dependen de
// runtime, red ni proveedores externos. Son la base del análisis multi-documento
// del servidor MCP y funcionan sin embeddings ni claves de API.
//
// Complementan —no sustituyen— la búsqueda semántica del RAG: esto mide
// solapamiento de vocabulario (superficie léxica); los embeddings miden
// significado. Donde hay embeddings, ambos se combinan; donde no, esto rinde
// solo.
// ============================================================================

/** Minúsculas + sin tildes. Mismo criterio para stopwords y para tokens. */
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Palabras vacías (ES + EN) que no aportan señal temática. Lista compacta y
 * deliberadamente conservadora: elimina el ruido más frecuente sin arriesgarse
 * a descartar términos con carga semántica.
 *
 * Se normaliza igual que los tokens (sin tildes): de lo contrario "más" -> "mas"
 * escaparía el filtro porque `tokenize` compara ya sin tildes.
 */
const STOPWORDS = new Set(
  [
  // español
  "el", "la", "los", "las", "un", "una", "unos", "unas", "lo", "al", "del",
  "y", "o", "u", "e", "ni", "que", "qué", "como", "cómo", "cuando", "cuándo",
  "donde", "dónde", "quien", "quién", "cual", "cuál", "con", "sin", "por",
  "para", "pero", "más", "menos", "muy", "sus", "sea", "son", "ser", "es",
  "está", "están", "este", "esta", "estos", "estas", "ese", "esa", "esos",
  "esas", "esto", "eso", "aquel", "sobre", "entre", "hasta", "desde", "según",
  "porque", "pues", "también", "tan", "ya", "no", "si", "sí", "se", "su", "de",
  "en", "a", "ha", "han", "hay", "fue", "han", "les", "le", "les", "nos", "me",
  "mi", "te", "tu", "tus", "sus", "nuestro", "nuestra", "vuestro", "otro",
  "otra", "otros", "otras", "todo", "toda", "todos", "todas", "cada", "algún",
  "alguna", "algunos", "algunas", "ningún", "cualquier", "puede", "pueden",
  "debe", "deben", "hacer", "hace", "hacen",
  // inglés
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "as", "by", "at", "from", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "if", "then", "than", "so",
  "such", "not", "no", "can", "will", "would", "should", "could", "may",
  "which", "who", "what", "when", "where", "how", "there", "their", "they",
  "you", "your", "we", "our", "he", "she", "his", "her", "them", "about",
  "into", "over", "also", "more", "most", "some", "any", "all", "each",
  ].map(normalizeWord),
);

/**
 * Divide un texto en términos normalizados: minúsculas, sin tildes, sin palabras
 * vacías, sin números puros y descartando tokens de menos de 3 caracteres.
 */
export function tokenize(text: string): string[] {
  return normalizeWord(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(
      (word) =>
        word.length > 2 && !STOPWORDS.has(word) && !/^\d+$/.test(word),
    );
}

/** Vector de frecuencias término -> nº de apariciones. */
export type TermVector = Map<string, number>;

export function termFrequencies(tokens: string[]): TermVector {
  const tf: TermVector = new Map();
  for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
  return tf;
}

export interface TermCount {
  term: string;
  count: number;
}

/** Los `n` términos más frecuentes de un vector, de mayor a menor. */
export function topTerms(tf: TermVector, n: number): TermCount[] {
  return [...tf.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([term, count]) => ({ term, count }));
}

/**
 * Similitud coseno [0..1] entre dos vectores de términos.
 *
 * 1 = mismo vocabulario en las mismas proporciones; 0 = sin términos en común.
 * Es la medida de solapamiento léxico entre dos documentos.
 */
export function cosineSimilarity(a: TermVector, b: TermVector): number {
  if (a.size === 0 || b.size === 0) return 0;

  let dot = 0;
  // Se itera sobre el vector más pequeño para el producto escalar.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other) dot += weight * other;
  }
  if (dot === 0) return 0;

  const norm = (v: TermVector) => {
    let sum = 0;
    for (const w of v.values()) sum += w * w;
    return Math.sqrt(sum);
  };

  return dot / (norm(a) * norm(b));
}

/** Frecuencia de documento: en cuántos documentos aparece cada término. */
export function documentFrequencies(vectors: TermVector[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const tf of vectors) {
    for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }
  return df;
}

export interface KeywordScore {
  term: string;
  score: number;
}

/**
 * Palabras clave de un documento por TF-IDF frente a un corpus.
 *
 * Un término puntúa alto si es frecuente en ESTE documento pero raro en el
 * resto: eso es lo que lo hace distintivo. Sirve para "temas distintivos" y para
 * separar lo que un documento tiene de propio frente a lo que comparte.
 */
export function tfidfKeywords(
  docTf: TermVector,
  df: Map<string, number>,
  corpusSize: number,
  n: number,
): KeywordScore[] {
  const scores: KeywordScore[] = [];
  for (const [term, freq] of docTf) {
    const docFreq = df.get(term) ?? 1;
    const idf = Math.log((corpusSize + 1) / (docFreq + 1)) + 1;
    scores.push({ term, score: freq * idf });
  }
  return scores
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
    .slice(0, n);
}

/** Nº de tokens significativos de un texto (longitud útil, no caracteres). */
export function wordCount(tokens: string[]): number {
  return tokens.length;
}
