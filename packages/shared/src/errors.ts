/**
 * Mensaje de error legible a partir de una excepción desconocida (p. ej. la
 * que lanzan los services al fallar una llamada a Supabase).
 *
 * Vive en `shared` porque cualquier consumidor de `@readhub/services` —la web
 * hoy, el servidor MCP mañana— necesita traducir esos errores a texto.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Ha ocurrido un error inesperado.";
}
