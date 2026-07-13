"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PenSquare, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/assistant", label: "Asistente", icon: Sparkles },
  { href: "/upload", label: "Cargar artículo", icon: PenSquare },
] as const;

interface NavLinksProps {
  className?: string;
  onNavigate?: () => void;
}

// Enlaces principales de la barra, con estado activo según la ruta actual.
// Se reutiliza tanto en la vista de escritorio como en el menú móvil.
export function NavLinks({ className, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex", className)}>
      {LINKS.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
