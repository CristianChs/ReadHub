import { Spinner } from "./spinner";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

// Estado de carga centrado y accesible. Reutilizable en cualquier sección.
export function LoadingState({
  message = "Cargando…",
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground",
        className,
      )}
    >
      <Spinner className="size-6" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
