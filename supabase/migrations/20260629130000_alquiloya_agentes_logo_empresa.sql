-- =============================================================================
-- AlquiloYa · agentes.logo_empresa_url
-- Logo de la inmobiliaria/empresa del agente. Se muestra en el perfil publico
-- y opcionalmente en watermark de fotos. Idempotente.
-- =============================================================================

ALTER TABLE alquiloya.agentes
  ADD COLUMN IF NOT EXISTS logo_empresa_url text;

SELECT pg_notify('pgrst', 'reload schema');
