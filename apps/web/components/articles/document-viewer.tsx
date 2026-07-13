"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";

import { ArticleContent } from "./article-content";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

function getExtension(url: string): string {
  const clean = url.split("?")[0];
  const match = clean.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

interface DocumentViewerProps {
  url: string;
}

// Muestra el documento del artículo según su formato: texto plano inline,
// PDF embebido, o un enlace de descarga para formatos no previsualizables
// en el navegador (DOCX).
export function DocumentViewer({ url }: DocumentViewerProps) {
  const extension = getExtension(url);

  if (extension === "pdf") {
    return (
      <div className="space-y-2">
        <iframe
          src={url}
          title="Documento del artículo"
          className="h-[70vh] min-h-[420px] w-full rounded-lg border border-border"
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Download className="size-4" />
          Abrir en una pestaña nueva
        </a>
      </div>
    );
  }

  if (extension === "txt") {
    return <PlainTextDocument url={url} />;
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-4">
      <FileText className="size-6 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Documento adjunto</p>
        <p className="text-xs text-muted-foreground">
          Este formato no se puede previsualizar en el navegador.
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
      >
        <Download className="size-4" />
        Descargar
      </a>
    </div>
  );
}

function PlainTextDocument({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el documento.");
        return res.text();
      })
      .then((text) => {
        if (active) setContent(text);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "No se pudo cargar el documento.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [url]);

  if (loading) return <LoadingState message="Cargando documento…" />;
  if (error) return <ErrorState title="No se pudo cargar el documento" message={error} />;
  return <ArticleContent content={content ?? ""} />;
}
