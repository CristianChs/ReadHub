// Fila cruda de la tabla `articles` (snake_case, igual que en la BD).
export interface Article {
  id: string;
  author_id: string;
  title: string;
  summary: string | null;
  document_path: string | null;
  image_path: string | null;
  created_at: string;
  is_public: boolean;
  category_id: string | null;
}

// Modelos de aplicación (camelCase) que devuelven los services tras normalizar
// las filas y agregar los contadores de views/likes.

export interface ArticleListItem {
  id: string;
  title: string;
  summary: string | null;
  imagePath: string | null;
  authorId: string;
  createdAt: string;
  categoryId: string | null;
  views: number;
  likes: number;
}

export interface ArticleDetail extends ArticleListItem {
  documentPath: string | null;
  isPublic: boolean;
}

export interface CreateArticleInput {
  authorId: string;
  title: string;
  summary?: string | null;
  documentPath?: string | null;
  imagePath?: string | null;
  isPublic?: boolean;
}

export interface UpdateArticleInput {
  title?: string;
  summary?: string | null;
  isPublic?: boolean;
}
