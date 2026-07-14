import {
  ArticleCard,
  type ArticleCardData,
} from "@/components/cards/article-card";

interface ArticleListProps {
  articles: ArticleCardData[];
}

// Las tres primeras tarjetas son la fila superior en escritorio: están sobre
// el pliegue y una de ellas será el LCP. Se cargan con prioridad; el resto,
// en diferido.
const PRIORITY_CARDS = 3;

// Grilla responsive de tarjetas de artículo (1 / 2 / 3 columnas).
export function ArticleList({ articles }: ArticleListProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, index) => (
        <ArticleCard
          key={article.id}
          article={article}
          priority={index < PRIORITY_CARDS}
        />
      ))}
    </div>
  );
}
