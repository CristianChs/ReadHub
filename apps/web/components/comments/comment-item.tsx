import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/format";

interface CommentItemProps {
  authorName: string;
  content: string;
  createdAt: string;
}

// Un comentario: avatar, autor, fecha y texto.
export function CommentItem({
  authorName,
  content,
  createdAt,
}: CommentItemProps) {
  return (
    <article className="flex gap-3">
      <Avatar name={authorName} className="size-8" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{authorName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDate(createdAt)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm text-foreground/90">
          {content}
        </p>
      </div>
    </article>
  );
}
