// Fila cruda de la tabla `comments` (snake_case, igual que en la BD).
export interface Comment {
  id: string;
  article_id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

// Modelo de aplicación (camelCase) que devuelven los services.
export interface CommentListItem {
  id: string;
  articleId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface CreateCommentInput {
  articleId: string;
  userId: string;
  comment: string;
}
