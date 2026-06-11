-- =============================================================================
-- AlquiloYa · Días de publicación editables por propiedad
--
-- Antes: para el plan gratis, la publicación se ocultaba del sitio público
-- a los 30 días desde created_at (hardcoded en public-api.ts). No había
-- forma de extender o acortar ese plazo desde el ERP.
--
-- Ahora: propiedades.publicacion_dias guarda el plazo en días para esa
-- propiedad puntual. NULL = usa el default global (30). El filtro público
-- usa COALESCE(p.publicacion_dias, 30) para decidir si seguir mostrando.
--
-- Idempotente.
-- =============================================================================

ALTER TABLE alquiloya.propiedades
  ADD COLUMN IF NOT EXISTS publicacion_dias integer;

ALTER TABLE alquiloya.propiedades
  DROP CONSTRAINT IF EXISTS propiedades_publicacion_dias_chk;

ALTER TABLE alquiloya.propiedades
  ADD CONSTRAINT propiedades_publicacion_dias_chk
    CHECK (publicacion_dias IS NULL OR (publicacion_dias >= 1 AND publicacion_dias <= 3650));

SELECT pg_notify('pgrst', 'reload schema');
