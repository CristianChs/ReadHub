// Cliente del Route Handler de indexación. Lo consumen los hooks; ningún hook
// habla con los Services de RAG directamente (las claves viven en el servidor).

/**
 * Solicita la indexación vectorial de un artículo.
 *
 * Deliberadamente NO lanza: la indexación es un efecto secundario de publicar
 * o editar, y su fallo jamás debe tumbar esa operación. Devuelve si tuvo éxito
 * para que el llamador pueda avisar sin bloquear.
 *
 * `keepalive` mantiene viva la petición aunque el usuario navegue de inmediato
 * (tras publicar se redirige al home), evitando que el navegador la aborte.
 */
export async function requestArticleIndexing(
  articleId: string,
): Promise<boolean> {
  try {
    const response = await fetch(`/api/v1/articles/${articleId}/index`, {
      method: "POST",
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
