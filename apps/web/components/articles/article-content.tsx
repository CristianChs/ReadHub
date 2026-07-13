import { cn } from "@/lib/utils";

interface ArticleContentProps {
  content: string;
  className?: string;
}

// Cuerpo del artículo con tipografía serif de lectura. Divide el texto plano
// en párrafos por líneas en blanco. Solo presentación.
export function ArticleContent({ content, className }: ArticleContentProps) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className={cn("article-body", className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
