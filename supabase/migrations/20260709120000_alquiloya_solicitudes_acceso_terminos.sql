-- =============================================================================
-- AlquiloYa · registra aceptacion de bases y condiciones en solicitudes_acceso
--
-- Para el programa de afiliados (tipo='referido_partner') el solicitante debe
-- aceptar el Contrato de Afiliados antes de enviar el formulario publico.
-- Guardamos el snapshot legal: cuando lo acepto, que version y desde que IP.
-- Idempotente: usa ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE alquiloya.solicitudes_acceso
  ADD COLUMN IF NOT EXISTS terminos_aceptados_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terminos_version TEXT,
  ADD COLUMN IF NOT EXISTS terminos_ip TEXT;

SELECT pg_notify('pgrst', 'reload schema');
