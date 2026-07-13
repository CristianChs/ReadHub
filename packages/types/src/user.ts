export type Role = "reader" | "writer" | "admin";

export interface Profile {
  id: string;
  full_name: string | null;
  birth_date: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
}

// Vista pública author_profiles: solo datos no sensibles para mostrar autor.
export interface AuthorProfile {
  id: string;
  full_name: string | null;
}
