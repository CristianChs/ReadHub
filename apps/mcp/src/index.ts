#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "./server.js";

/**
 * Punto de entrada del servidor MCP de ReadHub. Transporte STDIO.
 *
 * REGLA CRÍTICA DEL TRANSPORTE STDIO: stdout es el canal del protocolo
 * JSON-RPC. Cualquier `console.log` lo corrompería. Todo diagnóstico debe ir a
 * **stderr** (`console.error`), que el cliente ignora.
 */
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error("[readhub-mcp] servidor iniciado sobre STDIO");
}

main().catch((error) => {
  console.error("[readhub-mcp] fallo al iniciar:", error);
  process.exit(1);
});
