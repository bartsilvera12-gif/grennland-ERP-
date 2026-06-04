-- =============================================================================
-- AlquiloYa · Packs de impulsos editables desde el ERP
-- Reemplaza el IMPULSE_PACKS hardcodeado de public/alquiloya-legacy/data.jsx
-- Idempotente.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS alquiloya;

CREATE TABLE IF NOT EXISTS alquiloya.impulsos_packs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  codigo      text NOT NULL,           -- ej. "pack-5"
  qty         int  NOT NULL CHECK (qty > 0),
  precio      numeric(14,2) NOT NULL CHECK (precio >= 0),
  moneda      text NOT NULL DEFAULT 'PYG',
  badge       text,                    -- 'popular' | 'best' | null
  orden       int  NOT NULL DEFAULT 0,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS impulsos_packs_empresa_idx
  ON alquiloya.impulsos_packs (empresa_id, activo, orden);

CREATE OR REPLACE FUNCTION alquiloya.impulsos_packs_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'impulsos_packs_set_updated_at'
      AND tgrelid = 'alquiloya.impulsos_packs'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER impulsos_packs_set_updated_at
             BEFORE UPDATE ON alquiloya.impulsos_packs
             FOR EACH ROW EXECUTE FUNCTION alquiloya.impulsos_packs_set_updated_at()';
  END IF;
END $$;

-- Seed inicial (los mismos packs que estaban hardcoded). Solo si la tabla está vacía.
INSERT INTO alquiloya.impulsos_packs (empresa_id, codigo, qty, precio, badge, orden)
SELECT 'cf5df6fb-7705-4c4e-b29c-97bf5f314d8f'::uuid, codigo, qty, precio, badge, orden
FROM (VALUES
  ('pack-1',  1,  25000::numeric,  NULL,      0),
  ('pack-5',  5,  99000::numeric,  'popular', 1),
  ('pack-10', 10, 169000::numeric, NULL,      2),
  ('pack-25', 25, 349000::numeric, 'best',    3)
) AS seed(codigo, qty, precio, badge, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM alquiloya.impulsos_packs
   WHERE empresa_id = 'cf5df6fb-7705-4c4e-b29c-97bf5f314d8f'::uuid
);

SELECT pg_notify('pgrst', 'reload schema');
