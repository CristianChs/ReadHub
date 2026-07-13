"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { articleService } from "@readhub/services";
import { getErrorMessage } from "@/lib/utils";

// ============================================================================
// useLikes — "Me gusta" de un artículo (Flujo 8 de la spec). Consume
// únicamente article.service. Impide múltiples likes del mismo usuario sobre
// el mismo artículo (la restricción unique de la BD es la garantía final).
//
// Nota: las políticas RLS actuales de `likes` no incluyen una política SELECT,
// por lo que `getLikeCount`/`hasLiked` solo devuelven datos visibles para el
// propio usuario autenticado; el contador puede no reflejar likes de terceros
// hasta que se ajuste esa política (decisión de infraestructura ya señalada).
// ============================================================================

export function useLikes(articleId: string | null, userId?: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!articleId) {
      setCount(0);
      setLiked(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [likeCount, alreadyLiked] = await Promise.all([
        articleService.getLikeCount(supabase, articleId),
        userId
          ? articleService.hasLiked(supabase, articleId, userId)
          : Promise.resolve(false),
      ]);
      setCount(likeCount);
      setLiked(alreadyLiked);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supabase, articleId, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(async () => {
    if (!articleId || !userId || toggling) return;
    setToggling(true);
    setError(null);

    // Actualización optimista.
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((prev) => (wasLiked ? Math.max(prev - 1, 0) : prev + 1));

    try {
      if (wasLiked) {
        await articleService.removeLike(supabase, articleId, userId);
      } else {
        await articleService.addLike(supabase, articleId, userId);
      }
    } catch (err) {
      // Revierte la actualización optimista si la operación falla.
      setLiked(wasLiked);
      setCount((prev) => (wasLiked ? prev + 1 : Math.max(prev - 1, 0)));
      setError(getErrorMessage(err));
    } finally {
      setToggling(false);
    }
  }, [supabase, articleId, userId, liked, toggling]);

  return { count, liked, loading, toggling, error, toggle, refresh };
}
