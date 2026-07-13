import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContextSource } from "@readhub/types";

interface SourcesListProps {
  sources: ContextSource[];
  className?: string;
}

/**
 * Fuentes utilizadas para fundamentar una respuesta.
 * El número coincide con la cita [n] que aparece en el texto del asistente.
 */
export function SourcesList({ sources, className }: SourcesListProps) {
  if (sources.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FileText className="size-3.5" />
        Fuentes
      </p>

      <ul className="space-y-1.5">
        {sources.map((source) => (
          <li key={source.articleId}>
            <Link
              href={source.url}
              className="group flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-semibold text-muted-foreground"
                aria-hidden="true"
              >
                {source.rank}
              </span>

              <span className="min-w-0 flex-1 truncate font-medium">
                {source.title}
              </span>

              <Badge variant="muted" title="Relevancia">
                {Math.round(source.similarity * 100)}%
              </Badge>

              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              <span className="sr-only">Abrir el artículo {source.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
