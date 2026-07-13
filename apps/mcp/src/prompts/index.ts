import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ContextFactory } from "../context.js";
import { registerCompareArticles } from "./compare-articles.prompt.js";
import { registerExplainArticle } from "./explain-article.prompt.js";
import { registerExtractKeyConcepts } from "./extract-key-concepts.prompt.js";
import { registerGenerateQuestions } from "./generate-questions.prompt.js";
import type { PromptRegistrar } from "./shared.js";
import { registerSummarizeArticle } from "./summarize-article.prompt.js";

/**
 * Registro de los **Prompts** del servidor MCP de ReadHub.
 *
 * Un Prompt devuelve una plantilla de mensajes; no ejecuta ni llama al LLM (eso
 * es la Tool `ask_readhub`). El material de cada artículo se obtiene de
 * `rag.articleContent`, la misma ruta de extracción que usa el indexador, de
 * modo que no se duplica lógica entre Prompts, Tools ni el pipeline RAG.
 *
 * Añadir un Prompt es crear un fichero `*.prompt.ts` que exporte un
 * `PromptRegistrar` y sumarlo a este array. El servidor no se toca.
 */
const PROMPTS: readonly PromptRegistrar[] = [
  registerSummarizeArticle,
  registerExplainArticle,
  registerCompareArticles,
  registerGenerateQuestions,
  registerExtractKeyConcepts,
];

export function registerPrompts(
  server: McpServer,
  getContext: ContextFactory,
): void {
  for (const register of PROMPTS) {
    register(server, getContext);
  }
}
