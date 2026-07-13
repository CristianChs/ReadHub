-- ============================================================================
-- Vista agregada de contadores por artículo (views y likes).
--
-- Las políticas RLS de `likes` (sin SELECT) y `views` (solo autor/admin) impiden
-- contar estas interacciones desde el cliente. Esta vista expone ÚNICAMENTE los
-- contadores agregados por artículo, sin revelar qué usuario dio like o vio el
-- artículo, para poder mostrarlos en el listado y el detalle.
--
-- Se define con security_invoker = off (comportamiento por defecto de las vistas)
-- de forma intencional: la vista, propiedad del owner, agrega las filas saltando
-- la RLS de las tablas base. Solo se exponen recuentos, no datos individuales.
-- ============================================================================

create view public.article_stats
with (security_invoker = off)
as
select
  a.id as article_id,
  (select count(*) from public.views v where v.article_id = a.id) as views_count,
  (select count(*) from public.likes l where l.article_id = a.id) as likes_count
from public.articles a;

grant select on public.article_stats to anon, authenticated;
