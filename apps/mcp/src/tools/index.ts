import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ContextFactory } from "../context.js";
import { registerCompareMultipleArticles } from "./analysis/compare-multiple-articles.tool.js";
import { registerDocumentRelationships } from "./analysis/document-relationships.tool.js";
import { registerExtractMainTopics } from "./analysis/extract-main-topics.tool.js";
import { registerGlobalSummary } from "./analysis/global-summary.tool.js";
import { registerResearchContext } from "./analysis/research-context.tool.js";
import { registerSimilaritiesDifferences } from "./analysis/similarities-differences.tool.js";
import { registerAskReadHub } from "./ask-readhub.tool.js";
import { registerGetArticle } from "./get-article.tool.js";
import { registerListArticles } from "./list-articles.tool.js";
import { registerSearchArticles } from "./search-articles.tool.js";
import { registerSemanticSearchArticles } from "./semantic-search-articles.tool.js";
import type { ToolRegistrar } from "./shared.js";

/**
 * Registro de las **Tools** del servidor MCP de ReadHub.
 *
 * Ninguna habla con Supabase ni con los proveedores de IA por su cuenta: la
 * lógica de negocio vive en `@readhub/services`, `@readhub/rag` y la matemática
 * de texto en `@readhub/shared`; aquí solo se orquesta y se traduce al protocolo.
 *
 * Dos familias:
 *  - CONSULTA: leer y buscar artículos (incluida la vía semántica y el RAG).
 *  - ANÁLISIS: análisis multi-documento (comparación, temas, relaciones,
 *    síntesis y contexto de investigación), determinista sobre el texto real.
 */
const QUERY_TOOLS: readonly ToolRegistrar[] = [
  registerListArticles,
  registerGetArticle,
  registerSearchArticles,
  registerSemanticSearchArticles,
  registerAskReadHub,
];

const ANALYSIS_TOOLS: readonly ToolRegistrar[] = [
  registerCompareMultipleArticles,
  registerSimilaritiesDifferences,
  registerExtractMainTopics,
  registerGlobalSummary,
  registerDocumentRelationships,
  registerResearchContext,
];

export function registerTools(
  server: McpServer,
  getContext: ContextFactory,
): void {
  for (const register of [...QUERY_TOOLS, ...ANALYSIS_TOOLS]) {
    register(server, getContext);
  }
}
