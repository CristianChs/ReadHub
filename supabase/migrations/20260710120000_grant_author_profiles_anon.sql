-- ============================================================================
-- author_profiles: lectura para clientes anónimos.
--
-- La vista se creó con SELECT restringido a `authenticated` (ver
-- 20260703120100). El servidor MCP se conecta con la anon key y sin sesión, así
-- que no podía resolver el nombre de ningún autor y los Resources/Tools tenían
-- que degradar `authorName` a null.
--
-- Conceder SELECT a `anon` es seguro por construcción: la vista es SECURITY
-- DEFINER (security_invoker = off) y proyecta ÚNICAMENTE id + full_name. El
-- teléfono, la fecha de nacimiento y el rol de `profiles` siguen fuera de
-- alcance. El nombre del autor ya es un dato público (aparece bajo cada
-- artículo), de modo que exponerlo a la anon key no revela nada nuevo.
-- ============================================================================

grant select on public.author_profiles to anon;
