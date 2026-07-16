"use client";

import { useEffect, useMemo, useRef } from "react";
import { RotateCcw, Sparkles } from "lucide-react";

import { useArticles } from "@/hooks/useArticles";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessage } from "@/components/chat/chat-message";
import { LoadingMessage } from "@/components/chat/loading-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

// Respaldo para cuando aún no hay artículos publicados de los que derivar
// ejemplos (plataforma vacía o listado todavía cargando).
const FALLBACK_SUGGESTIONS = ["¿Qué artículos hay publicados en ReadHub?"];

// Nº de sugerencias derivadas de los artículos más recientes.
const SUGGESTION_COUNT = 3;

/**
 * Ventana del asistente. Consume `useChat`, que a su vez habla con
 * /api/v1/chat. No contiene lógica de negocio: solo representa el estado.
 */
export function ChatWindow() {
  const { user } = useAuth();
  const { messages, loading, error, sendMessage, stop, reset } = useChat();
  const { articles } = useArticles();
  const bottomRef = useRef<HTMLDivElement>(null);

  const userName = user?.email ?? "Tú";
  const isEmpty = messages.length === 0;

  // Las sugerencias se derivan de los artículos publicados, no se mantienen a
  // mano: así reflejan siempre lo que el asistente puede responder. Se toman los
  // más recientes (article.service.list ya los devuelve por fecha descendente).
  const suggestions = useMemo(() => {
    if (articles.length === 0) return FALLBACK_SUGGESTIONS;
    return articles
      .slice(0, SUGGESTION_COUNT)
      .map((article) => `Resume el artículo «${article.title}»`);
  }, [articles]);

  // Se muestra el indicador solo mientras el asistente aún está RECUPERANDO:
  // en cuanto llega el evento `meta` ya hay fuentes que pintar, aunque el texto
  // todavía no haya empezado a llegar.
  const last = messages.at(-1);
  const awaitingRetrieval =
    loading &&
    last?.role === "assistant" &&
    last.content.length === 0 &&
    last.sources === undefined;

  // Desplazamiento automático a lo más reciente, también mientras llega el texto.
  //
  // `messages` cambia con cada token, así que esto se dispara decenas de veces
  // por respuesta. Dos precauciones:
  //   * el scroll se agenda en un frame de animación y se cancela el pendiente,
  //     de modo que una ráfaga de tokens produce UN solo desplazamiento;
  //   * durante el streaming el salto es instantáneo ("auto"): encadenar
  //     animaciones suaves que se cancelan entre sí provocaba tirones y
  //     mantenía el hilo principal ocupado.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: loading ? "auto" : "smooth",
        block: "end",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, loading]);

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col gap-4 sm:h-[calc(100dvh-13rem)]">
      {/* Área de mensajes */}
      <div
        className="flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Conversación con el asistente"
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center">
            <EmptyState
              icon={Sparkles}
              title="Pregunta sobre los artículos de ReadHub"
              description="El asistente responde únicamente con el conocimiento publicado en la plataforma, y cita sus fuentes."
            />
            <div className="flex flex-wrap justify-center gap-2 px-4">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(suggestion)}
                  className="h-auto whitespace-normal py-1.5 text-left"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-2">
            {messages.map((message) =>
              // Mientras se recupera (aún sin fuentes) se muestra el indicador.
              message.id === last?.id && awaitingRetrieval ? (
                <LoadingMessage key={message.id} />
              ) : (
                <ChatMessage
                  key={message.id}
                  message={message}
                  userName={userName}
                />
              ),
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Composición */}
      <div className="space-y-2">
        <ChatInput onSubmit={sendMessage} onStop={stop} loading={loading} />

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Las respuestas se basan solo en los artículos publicados.
          </p>
          {!isEmpty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={loading}
              className="shrink-0"
            >
              <RotateCcw className="size-3.5" />
              Nueva conversación
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
