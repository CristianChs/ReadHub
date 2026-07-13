import Link from "next/link";
import { BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";

// Logotipo + nombre de la plataforma. Enlaza siempre al home.
export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BookOpen className="size-5" />
      </span>
      <span className="text-lg font-bold tracking-tight">ReadHub</span>
    </Link>
  );
}
