"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import {
  useUpload,
  DOCUMENT_ACCEPT,
  IMAGE_ACCEPT,
} from "@/hooks/useUpload";
import { FormField } from "@/components/forms/form-field";
import { FileInput } from "@/components/forms/file-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PublishForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { publish, loading, error, fieldErrors, resetErrors } = useUpload();

  const [title, setTitle] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const article = await publish({
      authorId: user.id,
      title,
      documentFile,
      imageFile,
    });

    // Publicación exitosa: se redirige al Home, cuyo listado se recarga
    // automáticamente al montarse (useArticles) e incluye el nuevo artículo.
    if (article) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormField
        label="Título"
        htmlFor="title"
        error={fieldErrors.title}
        required
      >
        <Input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            resetErrors();
          }}
          aria-invalid={!!fieldErrors.title}
          placeholder="Título del artículo"
          disabled={loading}
        />
      </FormField>

      <FormField
        label="Documento"
        htmlFor="document"
        error={fieldErrors.document}
        hint="Formatos permitidos: TXT, DOCX o PDF (máx. 10 MB)."
        required
      >
        <FileInput
          id="document"
          accept={DOCUMENT_ACCEPT}
          fileName={documentFile?.name ?? null}
          onSelect={(file) => {
            setDocumentFile(file);
            resetErrors();
          }}
          placeholder="Seleccionar documento"
          invalid={!!fieldErrors.document}
          disabled={loading}
        />
      </FormField>

      <FormField
        label="Imagen de portada"
        htmlFor="image"
        error={fieldErrors.image}
        hint="Formatos permitidos: PNG, JPG, WEBP o GIF (máx. 5 MB)."
        required
      >
        <FileInput
          id="image"
          accept={IMAGE_ACCEPT}
          fileName={imageFile?.name ?? null}
          onSelect={(file) => {
            setImageFile(file);
            resetErrors();
          }}
          placeholder="Seleccionar imagen"
          invalid={!!fieldErrors.image}
          disabled={loading}
        />
      </FormField>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/")}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
        <SubmitButton
          loading={loading}
          loadingText="Publicando…"
          className="w-full sm:w-auto"
        >
          Publicar
        </SubmitButton>
      </div>
    </form>
  );
}
