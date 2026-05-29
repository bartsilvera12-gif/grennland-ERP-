-- =============================================================================
-- AlquiloYa · Fase 11E — Vínculo de referral_partners con usuario ERP
-- Permite que un partner tenga un usuario propio para entrar al portal de
-- referidos (rol 'referido_partner').
-- Idempotente.
-- =============================================================================

ALTER TABLE alquiloya.referral_partners
  ADD COLUMN IF NOT EXISTS usuario_id uuid;

-- FK opcional. Si la tabla alquiloya.usuarios no existe por algún motivo,
-- agregamos la constraint en bloque condicional.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referral_partners_usuario_fk'
  ) AND EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='alquiloya' AND c.relname='usuarios' AND c.relkind='r'
  ) THEN
    ALTER TABLE alquiloya.referral_partners
      ADD CONSTRAINT referral_partners_usuario_fk
      FOREIGN KEY (usuario_id) REFERENCES alquiloya.usuarios(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS referral_partners_usuario_idx
  ON alquiloya.referral_partners (usuario_id)
  WHERE usuario_id IS NOT NULL;

SELECT pg_notify('pgrst', 'reload schema');
