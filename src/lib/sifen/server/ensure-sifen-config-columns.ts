import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";

/**
 * Bootstrap idempotente: garantiza que `<schema>.empresa_sifen_config` tenga
 * TODAS las columnas que el código SIFEN espera.
 *
 * Motivo: el schema `alquiloya` se aprovisionó en producción por la suite
 * multi-tenant Zentra (`neura_provision_empresa_data_schema`) clonando la
 * estructura de `public.empresa_sifen_config` al momento del clone. Si el
 * clone ocurrió antes de que se agregaran columnas posteriores
 * (`certificado_password_encrypted`, KuDE branding, `sifen_plazo_cancelacion_horas`,
 * etc.), esas columnas faltan en `alquiloya.empresa_sifen_config` y los
 * PATCH del form `/configuracion/facturacion-electronica` fallan en silencio
 * o explotan al leer/escribir el campo cifrado.
 *
 * Este helper corre lazy 1 vez por proceso. ALTER TABLE ADD COLUMN IF NOT EXISTS
 * es 100 % aditivo e idempotente, no destruye datos existentes.
 */
let ready = false;

export async function ensureSifenConfigColumns(schema: string): Promise<void> {
  if (ready) return;
  const pool = getChatPostgresPool();
  if (!pool) return; // sin pool no podemos hacer nada — el caller seguira al fallback PostgREST.
  const t = quoteSchemaTable(schema, "empresa_sifen_config");
  try {
    await pool.query(`
      ALTER TABLE ${t}
        ADD COLUMN IF NOT EXISTS certificado_password_encrypted text,
        ADD COLUMN IF NOT EXISTS direccion_fiscal                text,
        ADD COLUMN IF NOT EXISTS timbrado_fecha_inicio_vigencia  date,
        ADD COLUMN IF NOT EXISTS timbrado_fecha_fin_vigencia     date,
        ADD COLUMN IF NOT EXISTS actividad_economica_codigo      text,
        ADD COLUMN IF NOT EXISTS actividad_economica_descripcion text,
        ADD COLUMN IF NOT EXISTS kude_logo_path                  text,
        ADD COLUMN IF NOT EXISTS kude_color_primario             text,
        ADD COLUMN IF NOT EXISTS kude_color_primario_fill        text,
        ADD COLUMN IF NOT EXISTS sifen_plazo_cancelacion_horas   integer NOT NULL DEFAULT 48,
        ADD COLUMN IF NOT EXISTS xml_firmado_path                text
    `);
    // PostgREST mantiene cache del schema. Notificamos para que recargue.
    await pool.query(`NOTIFY pgrst, 'reload schema'`);
    ready = true;
  } catch (err) {
    console.warn(
      "[ensureSifenConfigColumns] no se pudo aplicar el bootstrap:",
      err instanceof Error ? err.message : err,
    );
  }
}
