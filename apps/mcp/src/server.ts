import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getContext, type ContextFactory } from "./context.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";

export const SERVER_NAME = "readhub";
export const SERVER_VERSION = "0.1.0";

/**
 * Instrucciones para el cliente (campo `instructions` del handshake). El SDK las
 * entrega en `initialize` para que un LLM sepa cuándo usar cada familia sin tener
 * que deducirlo. Describe el mapa, no cada capacidad: eso ya va en su descripción.
 */
const SERVER_INSTRUCTIONS = `ReadHub es una plataforma de publicación de artículos, expuesta como base de conocimiento.

Cómo elegir capacidad:
- Explorar o localizar artículos: Tools de consulta (list_articles, search_articles) o los Resources readhub://articles, readhub://categories, readhub://authors.
- Responder una pregunta con el contenido publicado: ask_readhub (RAG con fuentes citadas).
- Analizar varios artículos a la vez (comparar, temas, relaciones, síntesis, contexto de investigación): Tools de análisis (compare_multiple_articles, find_similarities_and_differences, extract_main_topics, generate_global_summary, map_document_relationships, build_research_context).
- Redactar sobre un artículo (resumir, explicar, preguntas, conceptos): Prompts.

Notas:
- Las capacidades semánticas (semantic_search_articles, ask_readhub, y la vía semántica de build_research_context) requieren embeddings y claves de proveedor; si no están, degradan o devuelven un error explicativo. El análisis léxico funciona siempre.
- El servidor respeta las mismas políticas RLS que la web: solo ve artículos públicos.`;

/**
 * Construye el servidor MCP de ReadHub con sus capacidades registradas.
 *
 * Recibe una fábrica de contexto (inyección de dependencias): en producción es
 * `getContext`, y una prueba puede pasar la suya sin tocar Supabase. Nada se
 * evalúa hasta que una capacidad lo pide.
 *
 * Aquí NO hay lógica de negocio: vive en `@readhub/services` y `@readhub/rag`.
 */
export function createServer(contextFactory: ContextFactory = getContext): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      title: "ReadHub",
      version: SERVER_VERSION,
    },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerTools(server, contextFactory);
  registerResources(server, contextFactory);
  registerPrompts(server, contextFactory);

  return server;
}
