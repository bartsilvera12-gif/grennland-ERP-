-- =============================================================================
-- AlquiloYa · Fase 11B — Módulo "Referidos"
-- Base de tablas para programa de referidos / influencers / aliados.
-- Idempotente. No inserta datos. No crea triggers de comisiones (Fase 11E).
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS alquiloya;

-- ---------------------------------------------------------------------------
-- 1. referral_partners — el referidor (influencer, aliado, agente externo, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alquiloya.referral_partners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  nombre      text NOT NULL,
  email       text,
  telefono    text,
  tipo        text,   -- 'influencer' | 'aliado' | 'agente_referido' | 'otro'
  notas       text,
  activo      boolean NOT NULL DEFAULT true,
  usuario_id  uuid,   -- opcional, vínculo a alquiloya.usuarios si tiene login
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_partners_empresa_idx
  ON alquiloya.referral_partners (empresa_id);
CREATE INDEX IF NOT EXISTS referral_partners_empresa_activo_idx
  ON alquiloya.referral_partners (empresa_id, activo);
CREATE INDEX IF NOT EXISTS referral_partners_empresa_nombre_idx
  ON alquiloya.referral_partners (empresa_id, lower(nombre));

-- ---------------------------------------------------------------------------
-- 2. referral_links — uno o varios slugs por partner (multi-campaña)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alquiloya.referral_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL,
  partner_id   uuid NOT NULL
               REFERENCES alquiloya.referral_partners(id) ON DELETE CASCADE,
  slug         text NOT NULL,
  campania     text,
  cookie_dias  integer NOT NULL DEFAULT 60,
  activo       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_links_empresa_slug_uk
  ON alquiloya.referral_links (empresa_id, lower(slug));
CREATE INDEX IF NOT EXISTS referral_links_partner_idx
  ON alquiloya.referral_links (partner_id);
CREATE INDEX IF NOT EXISTS referral_links_empresa_activo_idx
  ON alquiloya.referral_links (empresa_id, activo);

-- ---------------------------------------------------------------------------
-- 3. referral_commission_rules — regla de comisión vigente (versionada)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alquiloya.referral_commission_rules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL,
  partner_id         uuid NOT NULL
                     REFERENCES alquiloya.referral_partners(id) ON DELETE CASCADE,
  link_id            uuid
                     REFERENCES alquiloya.referral_links(id) ON DELETE SET NULL,
  tipo               text NOT NULL,    -- 'porcentaje' | 'monto_fijo'
  valor              numeric(14,4) NOT NULL,
  moneda             text,             -- null si pct
  recurrente         boolean NOT NULL DEFAULT false,
  meses_recurrencia  integer,          -- null si !recurrente
  vigente_desde      timestamptz NOT NULL DEFAULT now(),
  vigente_hasta      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_rules_tipo_chk CHECK (tipo IN ('porcentaje','monto_fijo')),
  CONSTRAINT referral_rules_valor_chk CHECK (valor >= 0),
  CONSTRAINT referral_rules_recur_chk CHECK (
    (recurrente = false AND meses_recurrencia IS NULL)
    OR (recurrente = true AND meses_recurrencia IS NOT NULL AND meses_recurrencia > 0)
  )
);

CREATE INDEX IF NOT EXISTS referral_rules_empresa_idx
  ON alquiloya.referral_commission_rules (empresa_id);
CREATE INDEX IF NOT EXISTS referral_rules_partner_idx
  ON alquiloya.referral_commission_rules (partner_id);
CREATE INDEX IF NOT EXISTS referral_rules_link_idx
  ON alquiloya.referral_commission_rules (link_id);
CREATE INDEX IF NOT EXISTS referral_rules_vigente_idx
  ON alquiloya.referral_commission_rules (partner_id, vigente_desde DESC);

-- ---------------------------------------------------------------------------
-- 4. referral_clicks — un row por click (bigserial; alto volumen)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alquiloya.referral_clicks (
  id              bigserial PRIMARY KEY,
  empresa_id      uuid NOT NULL,
  link_id         uuid NOT NULL
                  REFERENCES alquiloya.referral_links(id) ON DELETE CASCADE,
  slug            text NOT NULL,   -- denormalizado para queries rápidas
  ip_hash         text,
  user_agent      text,
  referer         text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  visitor_cookie  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_clicks_link_created_idx
  ON alquiloya.referral_clicks (link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_clicks_empresa_created_idx
  ON alquiloya.referral_clicks (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_clicks_visitor_idx
  ON alquiloya.referral_clicks (visitor_cookie)
  WHERE visitor_cookie IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. referral_conversions — atribución de una compra/suscripción a un link
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alquiloya.referral_conversions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           uuid NOT NULL,
  link_id              uuid NOT NULL
                       REFERENCES alquiloya.referral_links(id) ON DELETE RESTRICT,
  partner_id           uuid NOT NULL
                       REFERENCES alquiloya.referral_partners(id) ON DELETE RESTRICT,
  rule_id              uuid
                       REFERENCES alquiloya.referral_commission_rules(id) ON DELETE SET NULL,
  target_tipo          text NOT NULL,   -- 'plan_publicacion' | 'propietario' | 'agente' | 'pedido_web' | 'otro'
  target_id            uuid NOT NULL,
  plan_publicacion_id  uuid,            -- snapshot opcional
  usuario_id           uuid,
  monto_base           numeric(14,2),
  moneda               text NOT NULL DEFAULT 'PYG',
  first_click_at       timestamptz,
  converted_at         timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_conversions_target_uk
  ON alquiloya.referral_conversions (empresa_id, target_tipo, target_id);
CREATE INDEX IF NOT EXISTS referral_conversions_partner_idx
  ON alquiloya.referral_conversions (partner_id, converted_at DESC);
CREATE INDEX IF NOT EXISTS referral_conversions_link_idx
  ON alquiloya.referral_conversions (link_id, converted_at DESC);
CREATE INDEX IF NOT EXISTS referral_conversions_empresa_idx
  ON alquiloya.referral_conversions (empresa_id, converted_at DESC);

-- ---------------------------------------------------------------------------
-- 6. referral_commissions — periodos de comisión generados por una conversión
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alquiloya.referral_commissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL,
  conversion_id         uuid NOT NULL
                        REFERENCES alquiloya.referral_conversions(id) ON DELETE CASCADE,
  partner_id            uuid NOT NULL
                        REFERENCES alquiloya.referral_partners(id) ON DELETE RESTRICT,
  periodo               char(7),                 -- 'YYYY-MM' (null si single-shot)
  monto_base            numeric(14,2),
  porcentaje_aplicado   numeric(7,4),
  monto_comision        numeric(14,2) NOT NULL,
  moneda                text NOT NULL DEFAULT 'PYG',
  estado                text NOT NULL DEFAULT 'pendiente',
  generada_at           timestamptz NOT NULL DEFAULT now(),
  pagada_at             timestamptz,
  pago_referencia       text,
  notas                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_commissions_estado_chk
    CHECK (estado IN ('pendiente','pagada','cancelada','reversada'))
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_commissions_conv_periodo_uk
  ON alquiloya.referral_commissions (conversion_id, COALESCE(periodo, ''));
CREATE INDEX IF NOT EXISTS referral_commissions_partner_estado_idx
  ON alquiloya.referral_commissions (partner_id, estado);
CREATE INDEX IF NOT EXISTS referral_commissions_empresa_estado_idx
  ON alquiloya.referral_commissions (empresa_id, estado, generada_at DESC);

-- ---------------------------------------------------------------------------
-- Trigger updated_at compartido (idempotente)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION alquiloya.referrals_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'referral_partners',
      'referral_links',
      'referral_commission_rules',
      'referral_commissions'
    ]) AS t
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = format('%s_set_updated_at', r.t)
        AND tgrelid = format('alquiloya.%I', r.t)::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON alquiloya.%I
         FOR EACH ROW EXECUTE FUNCTION alquiloya.referrals_set_updated_at()',
        r.t, r.t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS — mismo patrón que alquiloya.agentes/propiedades:
--   SELECT/UPDATE/DELETE: puede_acceder_empresa(empresa_id)
--   INSERT (WITH CHECK): puede_acceder_empresa(empresa_id)
-- Si la función helper no existe, RLS queda activa pero sin policies (deniega
-- todo a roles no-bypass; el ERP usa pg pool con superuser y NO pasa por RLS).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  has_fn boolean;
  t text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='alquiloya' AND p.proname='puede_acceder_empresa'
  ) INTO has_fn;

  FOREACH t IN ARRAY ARRAY[
    'referral_partners',
    'referral_links',
    'referral_commission_rules',
    'referral_clicks',
    'referral_conversions',
    'referral_commissions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE alquiloya.%I ENABLE ROW LEVEL SECURITY', t);

    IF has_fn THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_select ON alquiloya.%I', t, t);
      EXECUTE format(
        'CREATE POLICY %I_select ON alquiloya.%I FOR SELECT
         USING (alquiloya.puede_acceder_empresa(empresa_id))', t, t);

      EXECUTE format('DROP POLICY IF EXISTS %I_insert ON alquiloya.%I', t, t);
      EXECUTE format(
        'CREATE POLICY %I_insert ON alquiloya.%I FOR INSERT
         WITH CHECK (alquiloya.puede_acceder_empresa(empresa_id))', t, t);

      EXECUTE format('DROP POLICY IF EXISTS %I_update ON alquiloya.%I', t, t);
      EXECUTE format(
        'CREATE POLICY %I_update ON alquiloya.%I FOR UPDATE
         USING (alquiloya.puede_acceder_empresa(empresa_id))
         WITH CHECK (alquiloya.puede_acceder_empresa(empresa_id))', t, t);

      EXECUTE format('DROP POLICY IF EXISTS %I_delete ON alquiloya.%I', t, t);
      EXECUTE format(
        'CREATE POLICY %I_delete ON alquiloya.%I FOR DELETE
         USING (alquiloya.puede_acceder_empresa(empresa_id))', t, t);
    END IF;
  END LOOP;
END $$;

-- Refrescar cache PostgREST por si el schema está expuesto.
SELECT pg_notify('pgrst', 'reload schema');
