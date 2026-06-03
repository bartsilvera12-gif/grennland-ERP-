-- =============================================================================
-- AlquiloYa · Vincular usuario auth a propietario
-- alquiloya.usuarios.propietario_id permite a /api/propietario/me resolver
-- al propietario logueado a partir del JWT Supabase.
-- Idempotente.
-- =============================================================================

ALTER TABLE alquiloya.usuarios
  ADD COLUMN IF NOT EXISTS propietario_id uuid;

CREATE INDEX IF NOT EXISTS usuarios_propietario_id_idx
  ON alquiloya.usuarios (empresa_id, propietario_id)
  WHERE propietario_id IS NOT NULL;

SELECT pg_notify('pgrst', 'reload schema');
