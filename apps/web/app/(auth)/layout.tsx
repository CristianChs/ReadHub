import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { authService } from "@readhub/services";

// Layout de autenticación: pantalla centrada y marcada.
// Si ya hay sesión activa, se redirige al home (defensa en profundidad
// además del middleware).
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await authService.getCurrentUser(supabase);

  if (user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <BookOpen className="size-7" />
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">ReadHub</h1>
          <p className="text-sm text-muted-foreground">
            Publica y descubre artículos.
          </p>
        </div>
      </div>

      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
