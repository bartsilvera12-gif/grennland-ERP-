-- =============================================================================
-- AlquiloYa · Solicitudes de acceso: plan elegido por el solicitante
-- Permite que al pedir "Quiero este plan" desde la web publica quede registrado
-- el tier solicitado. Al aprobar, el ERP intenta asignar el plan al propietario.
-- Idempotente.
-- =============================================================================

ALTER TABLE alquiloya.solicitudes_acceso
  ADD COLUMN IF NOT EXISTS plan_tier_solicitado text;

CREATE INDEX IF NOT EXISTS solicitudes_acceso_plan_tier_idx
  ON alquiloya.solicitudes_acceso (empresa_id, plan_tier_solicitado);

SELECT pg_notify('pgrst', 'reload schema');
