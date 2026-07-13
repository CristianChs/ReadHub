-- ============================================================================
-- Política de SELECT para `likes`: cada usuario puede ver únicamente sus
-- propias filas (no las de otros usuarios). Sin esta política, ni siquiera el
-- propio usuario podía comprobar si ya había dado "Me gusta" a un artículo
-- (hasLiked siempre devolvía false), rompiendo el estado visual del botón.
-- El conteo agregado de likes por artículo sigue viniendo de la vista
-- article_stats (SECURITY DEFINER-like vía owner), que no se ve afectada.
-- ============================================================================

create policy likes_select_own
  on public.likes for select
  to authenticated
  using (auth.uid() = user_id);
