-- =============================================================================
-- AlquiloYa · solicitudes_servicio
-- Tabla generica para solicitudes que caen al ERP y requieren aprobacion manual:
--   - kind = 'cambio_plan'   → usuario existente quiere cambiar de plan
--   - kind = 'impulsos'      → compra de pack de impulsos (sin pasarela)
--   - kind = 'verificacion'  → solicitar verificacion de un inmueble
-- Todos los flujos sin pasarela: el equipo cobra por fuera y aprueba/rechaza.
-- Idempotente.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS alquiloya;

CREATE TABLE IF NOT EXISTS alquiloya.solicitudes_servicio (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('cambio_plan','impulsos','verificacion')),

  -- Identificacion del solicitante (sin auth en esta fase)
  nombre          text NOT NULL,
  email           text,
  telefono        text,

  -- Refs opcionales (resuelven en aprobacion)
  propiedad_id    uuid,           -- verificacion / impulsos
  propietario_id  uuid,           -- cambio_plan (matched por email/telefono al revisar)
  agente_id       uuid,           -- cambio_plan agente

  -- Payload por tipo
  plan_tier       text,           -- cambio_plan
  pack_id         text,           -- impulsos (ej. pack-5)
  pack_qty        int,            -- impulsos (cantidad)
  monto           numeric(14,2),  -- importe estimado (referencia)

  mensaje         text,

  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada')),
  motivo_rechazo  text,
  revisado_por    uuid,
  revisado_at     timestamptz,
  resultado_id    uuid,           -- id del cambio aplicado (propietario/propiedad)

  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solicitudes_servicio_empresa_idx
  ON alquiloya.solicitudes_servicio (empresa_id);
CREATE INDEX IF NOT EXISTS solicitudes_servicio_estado_idx
  ON alquiloya.solicitudes_servicio (empresa_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS solicitudes_servicio_kind_idx
  ON alquiloya.solicitudes_servicio (empresa_id, kind);

CREATE OR REPLACE FUNCTION alquiloya.solicitudes_servicio_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'solicitudes_servicio_set_updated_at'
      AND tgrelid = 'alquiloya.solicitudes_servicio'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER solicitudes_servicio_set_updated_at
             BEFORE UPDATE ON alquiloya.solicitudes_servicio
             FOR EACH ROW EXECUTE FUNCTION alquiloya.solicitudes_servicio_set_updated_at()';
  END IF;
END $$;

-- Tambien aprovechamos para agregar saldo de impulsos por propietario (acumulable).
ALTER TABLE alquiloya.propietarios
  ADD COLUMN IF NOT EXISTS impulsos_saldo int NOT NULL DEFAULT 0;

-- Verificacion: agregamos flag a propiedades. Idempotente.
ALTER TABLE alquiloya.propiedades
  ADD COLUMN IF NOT EXISTS verificada boolean NOT NULL DEFAULT false;

SELECT pg_notify('pgrst', 'reload schema');
