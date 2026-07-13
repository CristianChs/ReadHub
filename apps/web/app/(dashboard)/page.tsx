"use client";

import { FileText } from "lucide-react";

import { useArticles } from "@/hooks/useArticles";
import { ArticleList } from "@/components/articles/article-list";
import { ArticleListSkeleton } from "@/components/articles/article-card-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

// Página principal: listado de artículos públicos obtenidos desde Supabase
// (vía useArticles -> article.service). Cada tarjeta enlaza al detalle.
export default function HomePage() {
  const { articles, loading, error, refresh } = useArticles();

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Artículos
        </h1>
        <p className="text-sm text-muted-foreground">
          Explora las últimas publicaciones de la comunidad.
        </p>
      </header>

      {loading ? (
        <ArticleListSkeleton />
      ) : error ? (
        <ErrorState
          message="No pudimos cargar los artículos. Inténtalo de nuevo."
          onRetry={refresh}
        />
      ) : articles.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aún no hay artículos"
          description="Cuando se publiquen artículos, aparecerán aquí."
        />
      ) : (
        <ArticleList articles={articles} />
      )}
    </div>
  );
}
