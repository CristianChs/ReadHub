import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

// Indicador de carga giratorio, reutilizable en botones y estados.
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden="true" />
  );
}
