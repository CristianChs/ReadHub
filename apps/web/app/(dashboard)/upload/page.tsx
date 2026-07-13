import type { Metadata } from "next";

import { PublishForm } from "@/components/forms/publish-form";

export const metadata: Metadata = {
  title: "Cargar artículo",
};

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Cargar artículo
        </h1>
        <p className="text-sm text-muted-foreground">
          Publica un nuevo artículo con su documento e imagen de portada.
        </p>
      </header>

      <PublishForm />
    </div>
  );
}
