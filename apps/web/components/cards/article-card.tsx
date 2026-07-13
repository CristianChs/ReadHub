import Link from "next/link";
import { ImageOff } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { ArticleStats } from "@/components/articles/article-stats";
import { formatDate } from "@/lib/format";

// Vista mínima que necesita la tarjeta. Desacoplada de la fila de la BD.
export interface ArticleCardData {
  id: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  authorName: string;
  createdAt: string;
  views: number;
  likes: number;
}

// Tarjeta de artículo. Toda la superficie es un enlace al detalle.
export function ArticleCard({ article }: { article: ArticleCardData }) {
  return (
    <Link
      href={`/article/${article.id}`}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {article.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-8" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug tracking-tight">
            {article.title}
          </h3>

          {article.summary && (
            <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
              {article.summary}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={article.authorName} className="size-7" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {article.authorName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(article.createdAt)}
                </p>
              </div>
            </div>
            <ArticleStats views={article.views} likes={article.likes} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
