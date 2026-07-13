// Contratos de las categorías temáticas de ReadHub.

/** Una categoría del catálogo (modelo de aplicación, camelCase). */
export interface Category {
  id: string;
  /** Clave de negocio estable, apta para URLs y filtros. */
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
}

/** Categoría con el número de artículos públicos que la usan. */
export interface CategoryWithCount extends Category {
  articleCount: number;
}
