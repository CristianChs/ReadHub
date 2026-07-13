import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ContextFactory } from "../context.js";
import { registerArticleResources } from "./articles.resource.js";
import { registerAuthorResources } from "./authors.resource.js";
import { registerCategoryResources } from "./categories.resource.js";
import { registerOverviewResource } from "./overview.resource.js";
import type { ResourceRegistrar } from "./shared.js";
import { registerStatsResource } from "./stats.resource.js";

/**
 * Registro de los **Resources** del servidor MCP de ReadHub.
 *
 * Todos delegan en los services compartidos del monorepo: ninguno consulta
 * Supabase por su cuenta. Cada colección con entidades propias añade además una
 * plantilla `.../{id|slug}` navegable, de modo que un cliente MCP puede tanto
 * listar como profundizar.
 *
 * Añadir un Resource es crear un fichero `*.resource.ts` que exporte un
 * `ResourceRegistrar` y sumarlo a este array. El servidor no se toca.
 */
const RESOURCES: readonly ResourceRegistrar[] = [
  registerOverviewResource,
  registerStatsResource,
  registerArticleResources,
  registerAuthorResources,
  registerCategoryResources,
];

export function registerResources(
  server: McpServer,
  getContext: ContextFactory,
): void {
  for (const register of RESOURCES) {
    register(server, getContext);
  }
}
