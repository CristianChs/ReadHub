import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";

interface AvatarProps {
  name: string;
  className?: string;
}

// Avatar por iniciales (sin imagen). Reutilizable en tarjetas y comentarios.
export function Avatar({ name, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 select-none items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground",
        className,
      )}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}
