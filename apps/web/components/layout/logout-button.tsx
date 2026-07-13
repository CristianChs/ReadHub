"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

// Cierra la sesión (vía useAuth, que a su vez consume auth.service) y
// redirige al login. router.refresh() fuerza al middleware/layouts a
// re-evaluar el estado de auth, evitando el acceso a rutas protegidas con el
// botón "Atrás".
export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
      className={className}
    >
      <LogOut />
      Cerrar sesión
    </Button>
  );
}
