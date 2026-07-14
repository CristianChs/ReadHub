import Image from "next/image";
import { ImageOff } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { ArticleStats } from "./article-stats";
import { formatDate } from "@/lib/format";

interface ArticleHeaderProps {
  title: string;
  authorName: string;
  createdAt: string;
  imageUrl: string | null;
  views: number;
  likes: number;
}

// Cabecera de la vista de detalle: portada, título, autor y métricas.
export function ArticleHeader({
  title,
  authorName,
  createdAt,
  imageUrl,
  views,
  likes,
}: ArticleHeaderProps) {
  return (
    <header className="space-y-6">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted sm:aspect-[21/9]">
        {imageUrl ? (
          // Portada del detalle: es el elemento LCP de esta pantalla, así que
          // se precarga (`priority`) en vez de descubrirse al hidratar.
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 48rem, 100vw"
            priority
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-10" />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={authorName} />
            <div>
              <p className="text-sm font-medium">{authorName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(createdAt)}
              </p>
            </div>
          </div>
          <ArticleStats views={views} likes={likes} />
        </div>
      </div>
    </header>
  );
}
