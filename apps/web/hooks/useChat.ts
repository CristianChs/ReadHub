"use client";

import { useCallback, useRef, useState } from "react";

import { getErrorMessage } from "@/lib/utils";
import type { ChatMetadata, ChatStreamEvent, ContextSource } from "@readhub/types";

// ============================================================================
// useChat — estado de la conversación con el asistente.
//
// Habla ÚNICAMENTE con el Route Handler /api/v1/chat. No conoce Supabase, ni
// Claude, ni el proveedor de embeddings.
//
// El historial vive en memoria (sesión del usuario). La estructura está
// preparada para persistirlo sin cambios arquitectónicos: cada mensaje ya
// tiene `id` y `createdAt`, y `messages` es la única fuente de verdad. Cargar
// un historial guardado sería sembrar ese array al montar.
// ============================================================================

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  /** Solo en mensajes del asistente. */
  sources?: ContextSource[];
  /** false => el asistente respondió que no tiene información. */
  hasContext?: boolean;
  /** true mientras el texto sigue llegando. */
  streaming?: boolean;
  metadata?: ChatMetadata;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** Aplica un cambio parcial sobre un mensaje concreto. */
  const patchMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id ? { ...message, ...patch } : message,
        ),
      );
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const query = text.trim();
      if (!query || loading) return;

      setError(null);
      setLoading(true);

      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: query,
        createdAt: Date.now(),
      };
      const assistantId = createId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        streaming: true,
      };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          // El handler responde JSON normal en los errores previos al stream.
          const payload = await response.json().catch(() => null);
          throw new Error(
            payload?.error?.message ?? "No se pudo contactar con el asistente.",
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";

        // NDJSON: una línea = un evento. Se acumula porque un chunk de red
        // puede cortar una línea por la mitad.
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;

            const event = JSON.parse(line) as ChatStreamEvent;
            switch (event.type) {
              case "meta":
                patchMessage(assistantId, {
                  sources: event.sources,
                  hasContext: event.hasContext,
                });
                break;
              case "delta":
                answer += event.text;
                patchMessage(assistantId, { content: answer });
                break;
              case "done":
                patchMessage(assistantId, {
                  streaming: false,
                  metadata: event.metadata,
                });
                break;
              case "error":
                throw new Error(event.message);
            }
          }
        }
      } catch (err) {
        // Cancelar no es un error que deba mostrarse.
        if (err instanceof DOMException && err.name === "AbortError") {
          patchMessage(assistantId, { streaming: false });
        } else {
          setError(getErrorMessage(err));
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        }
      } finally {
        abortRef.current = null;
        setLoading(false);
        patchMessage(assistantId, { streaming: false });
      }
    },
    [loading, patchMessage],
  );

  /** Cancela la respuesta en curso. */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Vacía la conversación. */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
  }, []);

  return { messages, loading, error, sendMessage, stop, reset };
}
