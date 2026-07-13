"use client";

import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/forms/submit-button";

interface CommentFormProps {
  onSubmit?: (text: string) => void;
  submitting?: boolean;
  placeholder?: string;
}

// Formulario de comentario. Presentacional: gestiona solo el texto local y
// delega el guardado en `onSubmit`.
export function CommentForm({
  onSubmit,
  submitting = false,
  placeholder = "Escribe un comentario…",
}: CommentFormProps) {
  const [value, setValue] = React.useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = value.trim();
    if (!text) return;
    onSubmit?.(text);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={submitting}
      />
      <div className="flex justify-end">
        <SubmitButton
          loading={submitting}
          loadingText="Enviando…"
          disabled={!value.trim()}
        >
          Comentar
        </SubmitButton>
      </div>
    </form>
  );
}
