import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Composición de clases de Tailwind. Es una utilidad de PRESENTACIÓN: depende
 * de tailwind-merge y solo tiene sentido en la app web. Por eso no vive en
 * `@readhub/shared`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export (no duplicación): la implementación vive en @readhub/shared, pero
// hooks y componentes la venían importando desde "@/lib/utils".
export { getErrorMessage } from "@readhub/shared";
