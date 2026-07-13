import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { authService } from "@readhub/services";
import { Navbar } from "@/components/layout/navbar";

// Layout protegido del área privada. Exige sesión activa (defensa en
// profundidad además del middleware) y monta la barra de navegación común
// a todas las pantallas del dashboard.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await authService.getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const userName = user.email ?? "Usuario";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar userName={userName} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
