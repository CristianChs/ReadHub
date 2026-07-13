import type { TypedSupabaseClient } from "@readhub/database";
import type { CommentListItem, CreateCommentInput } from "@readhub/types";

// ============================================================================
// comment.service — única puerta de entrada a Supabase para comentarios.
// ============================================================================

interface CommentRow {
  id: string;
  article_id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

function mapComment(row: CommentRow): CommentListItem {
  return {
    id: row.id,
    articleId: row.article_id,
    authorId: row.user_id,
    content: row.comment,
    createdAt: row.created_at,
  };
}

// Comentarios de un artículo, del más antiguo al más reciente.
async function list(
  supabase: TypedSupabaseClient,
  articleId: string,
): Promise<CommentListItem[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, article_id, user_id, comment, created_at")
    .eq("article_id", articleId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as CommentRow[]).map(mapComment);
}

// Crea un comentario y devuelve el registro insertado (para actualizar la UI
// sin recargar).
async function create(
  supabase: TypedSupabaseClient,
  input: CreateCommentInput,
): Promise<CommentListItem> {
  const { data, error } = await supabase
    .from("comments")
    .insert({
      article_id: input.articleId,
      user_id: input.userId,
      comment: input.comment,
    })
    .select("id, article_id, user_id, comment, created_at")
    .single();
  if (error) throw error;
  return mapComment(data as CommentRow);
}

async function remove(
  supabase: TypedSupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw error;
}

export const commentService = {
  list,
  create,
  remove,
};
