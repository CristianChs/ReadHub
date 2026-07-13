"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { articleService } from "@readhub/services";
import { authService } from "@readhub/services";
import {
  storageService,
  DOCUMENTS_BUCKET,
  IMAGES_BUCKET,
} from "@readhub/services";
import { requestArticleIndexing } from "@/lib/api/indexing";
import { getErrorMessage } from "@/lib/utils";
import type { UpdateArticleInput } from "@readhub/types";

// ============================================================================
// useArticles — listado y detalle de artículos (backend puro TS: solo estado
// + orquestación de services, sin JSX). Consume únicamente article.service,
// auth.service (nombres de autor) y storage.service (URLs públicas).
// ============================================================================

// Vista enriquecida lista para pintar en una tarjeta.
export interface ArticleCardView {
  id: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  views: number;
  likes: number;
}

export interface ArticleDetailView extends ArticleCardView {
  documentUrl: string | null;
  isPublic: boolean;
}

async function resolveAuthorNames(
  supabase: ReturnType<typeof createClient>,
  authorIds: string[],
): Promise<Record<string, string>> {
  try {
    return await authService.getAuthorNames(supabase, authorIds);
  } catch {
    // Si falla la resolución de nombres, se sigue mostrando el listado
    // (con un nombre de respaldo) en vez de bloquear toda la pantalla.
    return {};
  }
}

// --- Listado ------------------------------------------------------------------

// Listado de artículos públicos, enriquecido con nombre de autor e imagen.
export function useArticles() {
  const supabase = useMemo(() => createClient(), []);
  const [articles, setArticles] = useState<ArticleCardView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await articleService.list(supabase);
      const authorNames = await resolveAuthorNames(
        supabase,
        rows.map((row) => row.authorId),
      );

      setArticles(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          imageUrl: row.imagePath
            ? storageService.getPublicUrl(supabase, IMAGES_BUCKET, row.imagePath)
            : null,
          authorId: row.authorId,
          authorName: authorNames[row.authorId] ?? "Autor",
          createdAt: row.createdAt,
          views: row.views,
          likes: row.likes,
        })),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { articles, loading, error, refresh };
}

// --- Detalle --------------------------------------------------------------

// Artículo individual. Registra automáticamente una visualización al montar
// (una sola vez por sesión de componente) cuando hay un usuario autenticado.
export function useArticle(articleId: string | null, viewerId?: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [article, setArticle] = useState<ArticleDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewedRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!articleId) {
      setArticle(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await articleService.getById(supabase, articleId);
      if (!row) {
        setArticle(null);
        return;
      }
      const authorNames = await resolveAuthorNames(supabase, [row.authorId]);

      setArticle({
        id: row.id,
        title: row.title,
        summary: row.summary,
        imageUrl: row.imagePath
          ? storageService.getPublicUrl(supabase, IMAGES_BUCKET, row.imagePath)
          : null,
        documentUrl: row.documentPath
          ? storageService.getPublicUrl(
              supabase,
              DOCUMENTS_BUCKET,
              row.documentPath,
            )
          : null,
        authorId: row.authorId,
        authorName: authorNames[row.authorId] ?? "Autor",
        createdAt: row.createdAt,
        views: row.views,
        likes: row.likes,
        isPublic: row.isPublic,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supabase, articleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Registro automático de visualización (Flujo 5 de la spec): una vez por
  // artículo mientras el componente permanece montado.
  useEffect(() => {
    if (!articleId || !viewerId) return;
    if (viewedRef.current === articleId) return;
    viewedRef.current = articleId;

    articleService.registerView(supabase, articleId, viewerId).catch(() => {
      // No bloquea la lectura del artículo si el registro de vista falla.
    });
  }, [supabase, articleId, viewerId]);

  return { article, loading, error, refresh };
}

// --- Mutaciones (editar / eliminar) -----------------------------------------

// Acciones de gestión sobre un artículo propio.
export function useArticleMutations() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    async (id: string, input: UpdateArticleInput) => {
      setLoading(true);
      setError(null);
      try {
        const article = await articleService.update(supabase, id, input);

        // Reindexación automática: el contenido vectorizado incluye título y
        // resumen, así que editarlos invalida los embeddings anteriores.
        // Idempotente y no bloqueante (ver useUpload).
        void requestArticleIndexing(id);

        return article;
      } catch (err) {
        setError(getErrorMessage(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  const remove = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        await articleService.remove(supabase, id);
      } catch (err) {
        setError(getErrorMessage(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  return { update, remove, loading, error };
}
