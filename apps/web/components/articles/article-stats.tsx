import { Eye, Heart } from "lucide-react";

import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ArticleStatsProps {
  views: number;
  likes: number;
  className?: string;
}

// Métricas de un artículo: visualizaciones y "Me gusta". Solo lectura.
export function ArticleStats({ views, likes, className }: ArticleStatsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1" title="Visualizaciones">
        <Eye className="size-4" />
        {formatCount(views)}
      </span>
      <span className="inline-flex items-center gap-1" title="Me gusta">
        <Heart className="size-4" />
        {formatCount(likes)}
      </span>
    </div>
  );
}
