"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  loading?: boolean;
  placeholder?: string;
}

/**
 * Campo de consulta. Presentacional: gestiona solo el texto local.
 * Enter envía; Shift+Enter inserta un salto de línea.
 */
export function ChatInput({
  onSubmit,
  onStop,
  loading = false,
  placeholder = "Pregunta algo sobre los artículos de ReadHub…",
}: ChatInputProps) {
  const [value, setValue] = React.useState("");
  const canSend = value.trim().length > 0 && !loading;

  function submit() {
    if (!canSend) return;
    onSubmit(value.trim());
    setValue("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"
    >
      <label htmlFor="chat-query" className="sr-only">
        Consulta para el asistente
      </label>
      <Textarea
        id="chat-query"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="max-h-40 min-h-10 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
      />

      {loading && onStop ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={onStop}
          aria-label="Detener la respuesta"
        >
          <Square className="size-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label="Enviar consulta"
        >
          <ArrowUp className="size-4" />
        </Button>
      )}
    </form>
  );
}
