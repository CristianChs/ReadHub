import {
  ArticleCard,
  type ArticleCardData,
} from "@/components/cards/article-card";

interface ArticleListProps {
  articles: ArticleCardData[];
}

// Grilla responsive de tarjetas de artículo (1 / 2 / 3 columnas).
export function ArticleList({ articles }: ArticleListProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
