"use client";

import { useState } from "react";
import { Menu, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/navigation/nav-links";
import { Brand } from "./brand";
import { LogoutButton } from "./logout-button";

interface NavbarProps {
  userName: string;
}

// Barra de navegación superior. Contiene logo + nombre, enlaces principales,
// nombre del usuario autenticado y cierre de sesión. En móvil colapsa los
// enlaces y la info de usuario en un menú desplegable.
export function Navbar({ userName }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Brand />
          <NavLinks className="hidden gap-1 md:flex" />
        </div>

        {/* Zona derecha — escritorio */}
        <div className="hidden items-center gap-3 md:flex">
          <span className="inline-flex max-w-[14rem] items-center gap-2 truncate text-sm text-muted-foreground">
            <User className="size-4 shrink-0" />
            <span className="truncate">{userName}</span>
          </span>
          <LogoutButton />
        </div>

        {/* Toggle — móvil */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Abrir menú"
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Panel desplegable — móvil */}
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 sm:px-6 lg:px-8">
            <NavLinks
              className="flex-col gap-1"
              onNavigate={() => setOpen(false)}
            />
            <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
              <span className="inline-flex max-w-[12rem] items-center gap-2 truncate text-sm text-muted-foreground">
                <User className="size-4 shrink-0" />
                <span className="truncate">{userName}</span>
              </span>
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
