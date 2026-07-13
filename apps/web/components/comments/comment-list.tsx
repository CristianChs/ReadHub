import { MessageSquare } from "lucide-react";

import { CommentItem } from "./comment-item";
import { EmptyState } from "@/components/ui/empty-state";

// Vista mínima de un comentario para el listado.
export interface CommentView {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface CommentListProps {
  comments: CommentView[];
}

// Lista de comentarios; muestra un estado vacío cuando no hay ninguno.
export function CommentList({ comments }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Aún no hay comentarios"
        description="Sé el primero en compartir tu opinión."
      />
    );
  }

  return (
    <ul className="space-y-6">
      {comments.map((comment) => (
        <li key={comment.id}>
          <CommentItem
            authorName={comment.authorName}
            content={comment.content}
            createdAt={comment.createdAt}
          />
        </li>
      ))}
    </ul>
  );
}
