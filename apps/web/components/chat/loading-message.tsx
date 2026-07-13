import { Bot } from "lucide-react";

/** Indicador mientras el asistente recupera y empieza a redactar. */
export function LoadingMessage() {
  return (
    <div className="flex gap-3" role="status" aria-live="polite">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        aria-hidden="true"
      >
        <Bot className="size-4" />
      </span>

      <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-3">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
        <span className="sr-only">El asistente está buscando en los artículos…</span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
      style={{ animationDelay: delay }}
      aria-hidden="true"
    />
  );
}
