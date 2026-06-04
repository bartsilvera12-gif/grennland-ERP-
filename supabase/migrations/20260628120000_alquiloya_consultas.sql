-- =============================================================================
-- AlquiloYa · alquiloya.consultas
-- Registra leads/consultas de interesados desde el sitio publico, asociados a
-- una propiedad y opcionalmente a su agente. Alimenta el bloque "Consultas
-- recientes" del panel del agente. Idempotente.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS alquiloya;

CREATE TABLE IF NOT EXISTS alquiloya.consultas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  agente_id     uuid,
  propiedad_id  uuid,
  nombre        text,
  telefono      text,
  email         text,
  mensaje       text,
  canal         text NOT NULL DEFAULT 'web' CHECK (canal IN ('web','whatsapp','telefono','mail','otro')),
  estado        text NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva','vista','respondida','descartada')),
  ip            text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consultas_empresa_idx
  ON alquiloya.consultas (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS consultas_agente_idx
  ON alquiloya.consultas (empresa_id, agente_id, created_at DESC)
  WHERE agente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS consultas_propiedad_idx
  ON alquiloya.consultas (empresa_id, propiedad_id)
  WHERE propiedad_id IS NOT NULL;

CREATE OR REPLACE FUNCTION alquiloya.consultas_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'consultas_set_updated_at'
      AND tgrelid = 'alquiloya.consultas'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER consultas_set_updated_at
             BEFORE UPDATE ON alquiloya.consultas
             FOR EACH ROW EXECUTE FUNCTION alquiloya.consultas_set_updated_at()';
  END IF;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
