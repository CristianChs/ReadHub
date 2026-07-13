// Entradas de los flujos de autenticación (capa de aplicación, camelCase).

export interface RegisterInput {
  email: string;
  password: string;
  birthDate?: string | null;
  phone?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}
