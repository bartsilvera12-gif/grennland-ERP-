import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { getClientSchema, getClientEmpresaId } from "@/lib/env/instance-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = getClientSchema();
const EMPRESA_ID = getClientEmpresaId();
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

/**
 * POST /api/propietario/propiedades/[id]/usar-impulso
 *
 * Consume 1 impulso del saldo del propietario logueado y destaca su propiedad
 * por 7 dÃ­as. Solo funciona si:
 *  - el usuario estÃ¡ autenticado y vinculado a un propietario
 *  - la propiedad pertenece a ese propietario
 *  - el saldo > 0
 *
 * Atomico (transaccion) â€” no resta saldo si no logro destacar.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id: propiedadId } = await ctx.params;
    if (!uuidRe.test(propiedadId)) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no autorizado" }, { status: 403 });
    }

    // Resolver propietario_id del usuario.
    const { data: uExt } = await supabase
      .from("usuarios")
      .select("propietario_id")
      .eq("id", usuario.id)
      .limit(1)
      .maybeSingle();
    const propietarioId = (uExt as { propietario_id?: string | null } | null)?.propietario_id ?? null;
    if (!propietarioId) {
      return NextResponse.json(
        { error: "Tu cuenta no estÃ¡ vinculada a un propietario" },
        { status: 403 }
      );
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1) Lock propietario + verificar saldo.
      const sal = await client.query<{ impulsos_saldo: number }>(
        `SELECT impulsos_saldo FROM ${t("propietarios")}
          WHERE empresa_id = $1::uuid AND id = $2::uuid AND activo = true
          FOR UPDATE`,
        [EMPRESA_ID, propietarioId]
      );
      const saldo = sal.rows[0]?.impulsos_saldo ?? 0;
      if (!sal.rows[0]) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Propietario no encontrado o inactivo" }, { status: 404 });
      }
      if (saldo <= 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "No tenÃ©s impulsos disponibles. ComprÃ¡ un pack para destacar." },
          { status: 409 }
        );
      }

      // 2) Verificar ownership de la propiedad.
      const prop = await client.query<{ id: string }>(
        `SELECT id FROM ${t("propiedades")}
          WHERE empresa_id = $1::uuid AND id = $2::uuid AND propietario_id = $3::uuid`,
        [EMPRESA_ID, propiedadId, propietarioId]
      );
      if (prop.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Esa propiedad no es tuya" },
          { status: 403 }
        );
      }

      // 3) Restar saldo.
      await client.query(
        `UPDATE ${t("propietarios")}
            SET impulsos_saldo = impulsos_saldo - 1, updated_at = now()
          WHERE empresa_id = $1::uuid AND id = $2::uuid`,
        [EMPRESA_ID, propietarioId]
      );

      // 4) Setear destacada + extender vencimiento.
      // Si ya estaba destacada y vigente, extiende 7 dias mas desde la fecha actual de vencimiento.
      const upd = await client.query<{ destacada_hasta: string }>(
        `UPDATE ${t("propiedades")} SET
            destacada = true,
            destacada_hasta = GREATEST(
              COALESCE(destacada_hasta, now()),
              now()
            ) + interval '7 days',
            updated_at = now()
          WHERE empresa_id = $1::uuid AND id = $2::uuid
          RETURNING destacada_hasta::text AS destacada_hasta`,
        [EMPRESA_ID, propiedadId]
      );

      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        propiedad_id: propiedadId,
        destacada_hasta: upd.rows[0].destacada_hasta,
        saldo_restante: saldo - 1,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[api/propietario/propiedades/[id]/usar-impulso]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
