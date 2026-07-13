// Tipado manual equivalente al generado por `supabase gen types typescript`.
// Regenerar con la CLI de Supabase una vez el proyecto esté enlazado, para
// mantenerlo sincronizado con las migraciones reales.
// Nota: cada tabla/vista incluye `Relationships` porque el tipo GenericSchema
// de postgrest-js lo exige; sin él, el cliente tipa las operaciones como never.
import type { Role } from "./user";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          birth_date: string | null;
          phone: string | null;
          role: Role;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          birth_date?: string | null;
          phone?: string | null;
          role?: Role;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          birth_date?: string | null;
          phone?: string | null;
          role?: Role;
          created_at?: string;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          summary: string | null;
          document_path: string | null;
          image_path: string | null;
          created_at: string;
          is_public: boolean;
          category_id: string | null;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          summary?: string | null;
          document_path?: string | null;
          image_path?: string | null;
          created_at?: string;
          is_public?: boolean;
          category_id?: string | null;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          summary?: string | null;
          document_path?: string | null;
          image_path?: string | null;
          created_at?: string;
          is_public?: boolean;
          category_id?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      views: {
        Row: {
          id: string;
          article_id: string;
          user_id: string;
          viewed_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          user_id: string;
          viewed_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          user_id?: string;
          viewed_at?: string;
        };
        Relationships: [];
      };
      likes: {
        Row: {
          id: string;
          article_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          article_id: string;
          user_id: string;
          comment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          user_id: string;
          comment: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          user_id?: string;
          comment?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          id: string;
          article_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      // Fragmentos vectorizados (base de conocimiento del RAG).
      // `embedding` viaja como literal de pgvector: "[0.1,0.2,...]".
      article_embeddings: {
        Row: {
          id: string;
          article_id: string;
          chunk_index: number;
          content: string;
          embedding: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          chunk_index: number;
          content: string;
          embedding: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          chunk_index?: number;
          content?: string;
          embedding?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      author_profiles: {
        Row: {
          id: string;
          full_name: string | null;
        };
        Relationships: [];
      };
      article_stats: {
        Row: {
          article_id: string;
          views_count: number;
          likes_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      // Búsqueda semántica sobre article_embeddings (SECURITY DEFINER).
      // `query_embedding` viaja como literal de pgvector: "[0.1,0.2,...]".
      match_article_chunks: {
        Args: {
          query_embedding: string;
          match_threshold: number;
          match_count: number;
        };
        Returns: {
          article_id: string;
          article_title: string;
          chunk_index: number;
          content: string;
          similarity: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
