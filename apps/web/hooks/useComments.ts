"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { commentService } from "@readhub/services";
import { authService } from "@readhub/services";
import { getErrorMessage } from "@/lib/utils";

// ============================================================================
// useComments — comentarios de un artículo (Flujo 7 de la spec). Consume
// únicamente comment.service y auth.service (nombres de autor). Al crear un
// comentario se actualiza la lista en memoria, sin recargar la página.
// ============================================================================

export interface CommentView {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export function useComments(articleId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const enrich = useCallback(
    async (rows: Awaited<ReturnType<typeof commentService.list>>) => {
      const authorIds = rows.map((row) => row.authorId);
      let authorNames: Record<string, string> = {};
      try {
        authorNames = await authService.getAuthorNames(supabase, authorIds);
      } catch {
        // Se sigue mostrando el comentario con nombre de respaldo.
      }
      return rows.map((row) => ({
        id: row.id,
        authorId: row.authorId,
        authorName: authorNames[row.authorId] ?? "Autor",
        content: row.content,
        createdAt: row.createdAt,
      }));
    },
    [supabase],
  );

  const refresh = useCallback(async () => {
    if (!articleId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await commentService.list(supabase, articleId);
      setComments(await enrich(rows));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supabase, articleId, enrich]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addComment = useCallback(
    async (userId: string, text: string) => {
      if (!articleId) return;
      setSubmitting(true);
      setError(null);
      try {
        const created = await commentService.create(supabase, {
          articleId,
          userId,
          comment: text,
        });
        const [enriched] = await enrich([created]);
        setComments((prev) => [...prev, enriched]);
      } catch (err) {
        setError(getErrorMessage(err));
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [supabase, articleId, enrich],
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      setError(null);
      try {
        await commentService.remove(supabase, commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } catch (err) {
        setError(getErrorMessage(err));
        throw err;
      }
    },
    [supabase],
  );

  return {
    comments,
    loading,
    error,
    submitting,
    addComment,
    removeComment,
    refresh,
  };
}
