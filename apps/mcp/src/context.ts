import type { TypedSupabaseClient } from "@readhub/database";
import {
  articleService,
  authService,
  categoryService,
  commentService,
  storageService,
} from "@readhub/services";
import {
  articleContentService,
  chatService,
  contextBuilderService,
  embeddingService,
  indexingService,
  vectorSearchService,
} from "@readhub/rag";

import { createSupabaseClient } from "./supabase.js";

// ============================================================================
// Contexto del servidor MCP.
//
// Reúne el cliente Supabase y TODA la lógica de negocio ya existente en el
// monorepo. No envuelve ni reimplementa nada: son las mismas referencias que
// usa la aplicación web.
//
// Las futuras Tools, Resources y Prompts recibirán este contexto y delegarán
// en él. Aquí NO se implementa ninguna capacidad.
// ============================================================================

/** Dominio de ReadHub. Seguro en cualquier runtime. */
export const services = {
  article: articleService,
  auth: authService,
  category: categoryService,
  comment: commentService,
  storage: storageService,
} as const;

/** Sistema RAG. Solo servidor: arrastra los SDK de IA y los extractores. */
export const rag = {
  articleContent: articleContentService,
  chat: chatService,
  contextBuilder: contextBuilderService,
  embedding: embeddingService,
  indexing: indexingService,
  vectorSearch: vectorSearchService,
} as const;

export interface ReadHubContext {
  supabase: TypedSupabaseClient;
  services: typeof services;
  rag: typeof rag;
}

let cached: ReadHubContext | null = null;

/**
 * Devuelve el contexto, creándolo la primera vez.
 *
 * Es **perezoso** a propósito: el cliente Supabase solo se construye cuando una
 * capacidad lo necesita. Así el servidor arranca y responde al handshake MCP
 * aunque el entorno todavía no esté configurado, en vez de morir al iniciar.
 */
export function getContext(): ReadHubContext {
  cached ??= { supabase: createSupabaseClient(), services, rag };
  return cached;
}

/** Firma que reciben los registradores de capacidades. */
export type ContextFactory = () => ReadHubContext;
