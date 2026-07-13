"use client";

import { useCallback, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { articleService } from "@readhub/services";
import {
  storageService,
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
} from "@readhub/services";
import { requestArticleIndexing } from "@/lib/api/indexing";
import { getErrorMessage } from "@/lib/utils";
import type { Article } from "@readhub/types";

// ============================================================================
// useUpload — flujo de publicación de un artículo (Flujo 6 de la spec):
// valida título y archivos, deriva el resumen, sube documento + imagen a
// Storage y crea el registro del artículo. Consume únicamente storage.service
// y article.service. Expone además los `accept` para los inputs de archivo,
// de modo que el componente no necesite importar de la capa services.
// ============================================================================

// Valores para el atributo `accept` de los selectores de archivo.
export const DOCUMENT_ACCEPT = ALLOWED_DOCUMENT_EXTENSIONS.join(",");
export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(",");

const SUMMARY_MAX = 200;

export interface PublishArticleInput {
  authorId: string;
  title: string;
  documentFile: File | null;
  imageFile: File | null;
}

// Errores de validación por campo, para pintar junto a cada input del form.
export interface PublishValidationErrors {
  title?: string;
  document?: string;
  image?: string;
}

function validate(input: PublishArticleInput): PublishValidationErrors {
  const errors: PublishValidationErrors = {};

  if (!input.title.trim()) {
    errors.title = "El título no puede estar vacío.";
  }

  if (!input.documentFile) {
    errors.document = "Debes seleccionar un documento.";
  } else {
    const documentError = storageService.validateDocument(input.documentFile);
    if (documentError) errors.document = documentError;
  }

  if (!input.imageFile) {
    errors.image = "Debes seleccionar una imagen de portada.";
  } else {
    const imageError = storageService.validateImage(input.imageFile);
    if (imageError) errors.image = imageError;
  }

  return errors;
}

// Deriva el resumen (primer párrafo) del documento cuando es texto plano.
// En PDF/DOCX no se extrae en cliente y queda null.
async function deriveSummary(file: File): Promise<string | null> {
  if (file.type !== "text/plain") return null;
  try {
    const text = await file.text();
    const firstParagraph = text.split(/\n{2,}/)[0]?.trim() ?? "";
    if (!firstParagraph) return null;
    return firstParagraph.length > SUMMARY_MAX
      ? `${firstParagraph.slice(0, SUMMARY_MAX).trimEnd()}…`
      : firstParagraph;
  } catch {
    return null;
  }
}

export function useUpload() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<PublishValidationErrors>({});

  const publish = useCallback(
    async (input: PublishArticleInput): Promise<Article | null> => {
      setError(null);

      const errors = validate(input);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        return null;
      }

      setLoading(true);
      try {
        // Los campos ya fueron validados como no nulos arriba.
        const documentFile = input.documentFile as File;
        const imageFile = input.imageFile as File;

        const summary = await deriveSummary(documentFile);

        const [documentPath, imagePath] = await Promise.all([
          storageService.uploadDocument(supabase, input.authorId, documentFile),
          storageService.uploadImage(supabase, input.authorId, imageFile),
        ]);

        const article = await articleService.create(supabase, {
          authorId: input.authorId,
          title: input.title.trim(),
          summary,
          documentPath,
          imagePath,
          isPublic: true,
        });

        // Indexación automática (Route Handler -> indexing.service).
        // Fuera del camino crítico: se dispara sin await para no retrasar la
        // redirección, y `requestArticleIndexing` nunca lanza. Si falla, el
        // artículo queda publicado igualmente y podrá reindexarse (idempotente).
        void requestArticleIndexing(article.id);

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

  const resetErrors = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  return { publish, loading, error, fieldErrors, resetErrors };
}
