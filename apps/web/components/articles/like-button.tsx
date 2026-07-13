"use client";

import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  count: number;
  liked?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  className?: string;
}

// Botón de "Me gusta". Presentacional: refleja `liked`/`count` y notifica
// `onToggle`; la regla de un like por usuario la aplica quien lo consume.
export function LikeButton({
  count,
  liked = false,
  onToggle,
  disabled,
  className,
}: LikeButtonProps) {
  return (
    <Button
      variant={liked ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={liked}
      className={className}
    >
      <Heart className={cn("size-4", liked && "fill-current")} />
      <span>{formatCount(count)}</span>
    </Button>
  );
}
