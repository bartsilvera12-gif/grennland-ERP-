-- =============================================================================
-- AlquiloYa · solicitudes_acceso ahora acepta tipo='referido_partner'
--   - Drop + recreate CHECK constraint
--   - Para referidos, el sub_tipo guarda el canal (instagram/tiktok/whatsapp/web/otro)
-- Idempotente.
-- =============================================================================

DO $$
DECLARE
  con_name text;
BEGIN
  -- Buscamos el nombre real del CHECK constraint sobre tipo (puede variar segun
  -- como se creo la tabla).
  SELECT c.conname INTO con_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'alquiloya'
     AND t.relname = 'solicitudes_acceso'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) ILIKE '%tipo%';

  IF con_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE alquiloya.solicitudes_acceso DROP CONSTRAINT %I',
      con_name
    );
  END IF;
END $$;

ALTER TABLE alquiloya.solicitudes_acceso
  ADD CONSTRAINT solicitudes_acceso_tipo_check
  CHECK (tipo IN ('agente', 'propietario', 'referido_partner'));

SELECT pg_notify('pgrst', 'reload schema');
