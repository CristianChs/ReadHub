import { memo } from "react";
import { Bot } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { SourcesList } from "@/components/chat/sources-list";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageModel } from "@/hooks/useChat";

interface ChatMessageProps {
  message: ChatMessageModel;
  /** Nombre del usuario, para el avatar de sus mensajes. */
  userName: string;
}

/** Un turno de la conversación. Presentacional: no contiene lógica. */
function ChatMessageBase({ message, userName }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <article
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
      aria-label={isUser ? "Tu mensaje" : "Respuesta del asistente"}
    >
      {isUser ? (
        <Avatar name={userName} className="size-8" />
      ) : (
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <Bot className="size-4" />
        </span>
      )}

      <div className={cn("min-w-0 flex-1 space-y-3", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "max-w-[85ch] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-card-foreground",
          )}
        >
          <p className="whitespace-pre-wrap">
            {message.content}
            {message.streaming && (
              <span
                className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-current align-text-bottom"
                aria-hidden="true"
              />
            )}
          </p>
        </div>

        {/* Las fuentes llegan antes que el texto: se pintan en cuanto existen. */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesList sources={message.sources} className="w-full max-w-[85ch]" />
        )}
      </div>
    </article>
  );
}

// `useChat` reemplaza el array de mensajes en CADA token del streaming, pero
// solo cambia el objeto del mensaje que está creciendo: los demás conservan su
// identidad. Sin memo, un token repintaba la conversación entera; con ella,
// solo se re-renderiza el turno que realmente cambió.
//
// La comparación por defecto (superficial sobre las props) basta: `message` es
// un objeto nuevo únicamente cuando su contenido cambió, y `userName` es un
// string estable.
export const ChatMessage = memo(ChatMessageBase);
