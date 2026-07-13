"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileQuestion, MessageSquare } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useArticle } from "@/hooks/useArticles";
import { useComments } from "@/hooks/useComments";
import { useLikes } from "@/hooks/useLikes";
import { ArticleHeader } from "@/components/articles/article-header";
import { DocumentViewer } from "@/components/articles/document-viewer";
import { LikeButton } from "@/components/articles/like-button";
import { CommentList } from "@/components/comments/comment-list";
import { CommentForm } from "@/components/comments/comment-form";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

// Vista de detalle de un artículo (Flujo 5): registra automáticamente una
// visualización, muestra el documento, la portada, los comentarios y los
// "Me gusta". Toda la información se obtiene desde Supabase vía hooks/services.
export default function ArticlePage() {
  const params = useParams<{ id: string }>();
  const articleId = params.id;

  const { user } = useAuth();
  const {
    article,
    loading: articleLoading,
    error: articleError,
    refresh: refreshArticle,
  } = useArticle(articleId, user?.id ?? null);
  const {
    comments,
    loading: commentsLoading,
    submitting: submittingComment,
    addComment,
  } = useComments(articleId);
  const { count: likeCount, liked, toggle: toggleLike } = useLikes(
    articleId,
    user?.id ?? null,
  );

  const backLink = (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href="/">
        <ArrowLeft className="size-4" />
        Volver al inicio
      </Link>
    </Button>
  );

  if (articleLoading) {
    return (
      <div className="space-y-6">
        {backLink}
        <LoadingState message="Cargando artículo…" />
      </div>
    );
  }

  if (articleError) {
    return (
      <div className="space-y-6">
        {backLink}
        <ErrorState
          message="No pudimos cargar el artículo. Inténtalo de nuevo."
          onRetry={refreshArticle}
        />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="space-y-6">
        {backLink}
        <EmptyState
          icon={FileQuestion}
          title="Artículo no encontrado"
          description="Es posible que haya sido eliminado o que el enlace sea incorrecto."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {backLink}

      <ArticleHeader
        title={article.title}
        authorName={article.authorName}
        createdAt={article.createdAt}
        imageUrl={article.imageUrl}
        views={article.views}
        likes={likeCount}
      />

      <LikeButton count={likeCount} liked={liked} onToggle={toggleLike} />

      {article.documentUrl ? (
        <DocumentViewer url={article.documentUrl} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Este artículo no tiene documento adjunto.
        </p>
      )}

      <section className="space-y-4 border-t border-border pt-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <MessageSquare className="size-5" />
          Comentarios
        </h2>

        <CommentForm
          submitting={submittingComment}
          onSubmit={(text) => {
            if (user) void addComment(user.id, text);
          }}
        />

        {commentsLoading ? (
          <LoadingState message="Cargando comentarios…" />
        ) : (
          <CommentList comments={comments} />
        )}
      </section>
    </div>
  );
}
