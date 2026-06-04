-- =============================================================================
-- AlquiloYa · alquiloya.testimonios
-- Testimonios reales (propietarios y agentes) editables desde el ERP que se
-- muestran en el home publico. Idempotente.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS alquiloya;

CREATE TABLE IF NOT EXISTS alquiloya.testimonios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  autor           text NOT NULL,
  rol             text,            -- 'Propietaria', 'Agente', 'Inquilino', etc.
  ciudad          text,
  contenido       text NOT NULL,
  foto_url        text,
  calificacion    int NOT NULL DEFAULT 5 CHECK (calificacion BETWEEN 1 AND 5),
  orden           int NOT NULL DEFAULT 0,
  activo          boolean NOT NULL DEFAULT true,
  destacado       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS testimonios_empresa_orden_idx
  ON alquiloya.testimonios (empresa_id, orden ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS testimonios_empresa_activo_idx
  ON alquiloya.testimonios (empresa_id, activo);

CREATE OR REPLACE FUNCTION alquiloya.testimonios_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'testimonios_set_updated_at'
      AND tgrelid = 'alquiloya.testimonios'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER testimonios_set_updated_at
             BEFORE UPDATE ON alquiloya.testimonios
             FOR EACH ROW EXECUTE FUNCTION alquiloya.testimonios_set_updated_at()';
  END IF;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
