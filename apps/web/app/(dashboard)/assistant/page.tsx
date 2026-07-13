import type { Metadata } from "next";

import { ChatWindow } from "@/components/chat/chat-window";

export const metadata: Metadata = {
  title: "Asistente",
};

export default function AssistantPage() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Asistente
        </h1>
        <p className="text-sm text-muted-foreground">
          Consulta el conocimiento publicado en ReadHub. Cada respuesta cita sus
          fuentes.
        </p>
      </header>

      <ChatWindow />
    </div>
  );
}
