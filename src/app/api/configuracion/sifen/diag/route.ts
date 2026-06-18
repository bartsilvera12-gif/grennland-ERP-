import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { getUserAndEmpresa } from "@/lib/middleware/auth";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";

/**
 * GET /api/configuracion/sifen/diag
 *
 * Diagnostico read-only del estado del modulo SIFEN para la empresa autenticada.
 * NO expone valores sensibles (passwords, certificado bytes, CSC, SIFEN_SECRETS_KEY).
 * Solo devuelve flags booleanas + metadatos no sensibles (tamaños, longitudes).
 *
 * Pensado para diagnosticar el bug recurrente "guardo la contraseña y no se
 * guarda": dice si el pool PG esta disponible, si el schema esta expuesto,
 * si las columnas del config existen, si la fila tiene el cifrado guardado.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndEmpresa(request);
    if (!auth) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const schema = await fetchDataSchemaForEmpresaId(auth.empresa_id);
    const pool = getChatPostgresPool();
    const sifenSecretsKey = process.env.SIFEN_SECRETS_KEY?.trim() ?? "";

    const report: Record<string, unknown> = {
      empresa_id: auth.empresa_id,
      schema_objetivo: schema,
      env: {
        SIFEN_SECRETS_KEY_set: sifenSecretsKey.length > 0,
        SIFEN_SECRETS_KEY_len_ok: sifenSecretsKey.length >= 16,
        SUPABASE_DB_URL_set: Boolean(process.env.SUPABASE_DB_URL?.trim()),
        DIRECT_URL_set: Boolean(process.env.DIRECT_URL?.trim()),
        DATABASE_URL_set: Boolean(process.env.DATABASE_URL?.trim()),
      },
      pg_pool_available: Boolean(pool),
    };

    if (!pool) {
      report.diagnostico =
        "PG pool NO disponible. La escritura de la contraseña cifrada usara PostgREST, que cachea schema en self-hosted y puede dropear columnas recien agregadas. Configura SUPABASE_DB_URL (o DIRECT_URL/DATABASE_URL) en el deploy.";
      return NextResponse.json(successResponse(report));
    }

    // Con pool: consultamos si la columna existe y si la fila la tiene seteada.
    try {
      const colRes = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = 'empresa_sifen_config'
          ORDER BY ordinal_position`,
        [schema],
      );
      report.empresa_sifen_config_columnas = colRes.rows.map((r) => r.column_name);
      const tieneEnc = colRes.rows.some((r) => r.column_name === "certificado_password_encrypted");
      report.columna_cert_pwd_enc_existe = tieneEnc;

      if (tieneEnc) {
        const rowRes = await pool.query<{ enc_len: number | null; cert_path: string | null; ruc: string | null; razon: string | null }>(
          `SELECT length(certificado_password_encrypted) AS enc_len,
                  certificado_path AS cert_path,
                  ruc,
                  razon_social AS razon
             FROM "${schema}"."empresa_sifen_config"
            WHERE empresa_id = $1::uuid
            LIMIT 1`,
          [auth.empresa_id],
        );
        const row = rowRes.rows[0];
        if (row) {
          report.fila_existe = true;
          report.tiene_certificado_password_encrypted = row.enc_len != null && Number(row.enc_len) > 0;
          report.encrypted_length = row.enc_len ?? null;
          report.tiene_certificado_path = Boolean(row.cert_path && row.cert_path.length > 0);
          report.tiene_ruc = Boolean(row.ruc && row.ruc.length > 0);
          report.tiene_razon_social = Boolean(row.razon && row.razon.length > 0);
        } else {
          report.fila_existe = false;
        }
      }

      if (!sifenSecretsKey || sifenSecretsKey.length < 16) {
        report.diagnostico =
          "SIFEN_SECRETS_KEY no esta seteada (o tiene menos de 16 chars). El encrypt va a fallar al intentar guardar la contraseña. Setea esta variable en el deploy.";
      } else if (!report.columna_cert_pwd_enc_existe) {
        report.diagnostico =
          "La columna certificado_password_encrypted NO existe en la tabla. El bootstrap (ALTER TABLE ADD COLUMN IF NOT EXISTS) no se aplico. Revisa logs del servidor.";
      } else if (report.fila_existe === false) {
        report.diagnostico =
          "No hay fila empresa_sifen_config para esta empresa. Crea la config primero (POST).";
      } else if (report.tiene_certificado_password_encrypted === false) {
        report.diagnostico =
          "La columna existe pero la fila tiene NULL/vacio en certificado_password_encrypted. Volve a guardar la contraseña — si esto persiste, hay algun path que sigue usando PostgREST stale.";
      } else {
        report.diagnostico = "Todo OK: contraseña cifrada esta guardada. Si firmar sigue fallando avisame.";
      }
    } catch (e) {
      report.diagnostico_query_err = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json(successResponse(report));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
