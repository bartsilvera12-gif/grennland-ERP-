import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}
function s(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}

type SolicitudFull = {
  id: string;
  empresa_id: string;
  tipo: "agente" | "propietario";
  sub_tipo: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  ciudad: string | null;
  mensaje: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  plan_tier_solicitado: string | null;
};

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = s(body.action, 20);
    if (action !== "aprobar" && action !== "rechazar") {
      return NextResponse.json({ error: "action invalida (aprobar|rechazar)" }, { status: 400 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const { rows: solRows } = await queryWithRetry<SolicitudFull>(
      pool,
      `SELECT id, empresa_id, tipo, sub_tipo, nombre, email, telefono,
              empresa, ciudad, mensaje, estado, plan_tier_solicitado
         FROM ${t("solicitudes_acceso")}
        WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    const sol = solRows?.[0];
    if (!sol) return NextResponse.json({ error: "solicitud no encontrada" }, { status: 404 });
    if (sol.estado !== "pendiente") {
      return NextResponse.json({ error: `solicitud ya ${sol.estado}` }, { status: 409 });
    }

    if (action === "rechazar") {
      const motivo = s(body.motivo_rechazo, 500);
      const { rows } = await queryWithRetry<{ id: string }>(
        pool,
        `UPDATE ${t("solicitudes_acceso")}
            SET estado='rechazada', motivo_rechazo=$3, revisado_por=$4::uuid, revisado_at=now()
          WHERE empresa_id=$1::uuid AND id=$2::uuid
          RETURNING id`,
        [ALQUILOYA_EMPRESA_ID, id, motivo, user.id]
      );
      return NextResponse.json({ success: true, id: rows[0].id, estado: "rechazada" });
    }

    // aprobar → crear agente o propietario y vincular resultado_id
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Resolver plan tier → uuid + billing para calcular vencimiento.
      let planId: string | null = null;
      let billing = "";
      if (sol.plan_tier_solicitado) {
        const pr = await client.query<{ id: string; billing: string | null }>(
          `SELECT id, billing FROM ${t("planes_publicacion")}
            WHERE empresa_id = $1::uuid AND tier = $2 AND activo = true LIMIT 1`,
          [ALQUILOYA_EMPRESA_ID, sol.plan_tier_solicitado]
        );
        planId = pr.rows[0]?.id ?? null;
        billing = (pr.rows[0]?.billing ?? "").toLowerCase();
      }
      const vencSql =
        !planId || billing === "gratis"
          ? "NULL"
          : billing === "anual"
            ? "now() + interval '365 days'"
            : "now() + interval '30 days'";

      let resultadoId: string;
      if (sol.tipo === "agente") {
        const cargo = sol.sub_tipo ?? "Independiente";
        const r = await client.query<{ id: string }>(
          `INSERT INTO ${t("agentes")}
             (empresa_id, nombre, email, telefono, whatsapp, cargo, activo,
              plan_publicacion_id, plan_vencimiento_at)
           VALUES ($1::uuid, $2, $3, $4, $4, $5, true, $6, ${vencSql})
           RETURNING id`,
          [ALQUILOYA_EMPRESA_ID, sol.nombre, sol.email, sol.telefono, cargo, planId]
        );
        resultadoId = r.rows[0].id;
      } else {
        const r = await client.query<{ id: string }>(
          `INSERT INTO ${t("propietarios")}
             (empresa_id, nombre, email, telefono, tipo_persona, estado, activo,
              plan_publicacion_id, plan_vencimiento_at)
           VALUES ($1::uuid, $2, $3, $4, 'fisica', 'verificado', true, $5, ${vencSql})
           RETURNING id`,
          [ALQUILOYA_EMPRESA_ID, sol.nombre, sol.email, sol.telefono, planId]
        );
        resultadoId = r.rows[0].id;
      }

      // Crear auth.users + alquiloya.usuarios (con propietario_id/agente_id) si hay email.
      // Si no hay email no podemos crear cuenta -> queda solo el registro y se completa manual.
      let portalCredentials: { email: string; tempPassword: string } | null = null;
      let usuarioErpId: string | null = null;
      if (sol.email) {
        try {
          const supabase = createServiceRoleClient();
          // Genera password temporal (12 chars alfanumericos + 2 simbolos).
          const tempPassword =
            crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "x").slice(0, 12) + "!9";
          const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email: sol.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              nombre: sol.nombre,
              fuente: "solicitud_acceso",
              tipo: sol.tipo,
            },
          });
          if (createErr) throw new Error(createErr.message);
          if (!created.user?.id) throw new Error("no se pudo crear el auth.user");

          const authUserId = created.user.id;
          const rol = sol.tipo === "agente" ? "publicador-agente" : "publicador-propietario";
          const insertUsuario = await client.query<{ id: string }>(
            `INSERT INTO ${t("usuarios")}
               (empresa_id, auth_user_id, email, nombre, rol,
                ${sol.tipo === "agente" ? "agente_id" : "propietario_id"})
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)
             RETURNING id`,
            [ALQUILOYA_EMPRESA_ID, authUserId, sol.email, sol.nombre, rol, resultadoId]
          );
          usuarioErpId = insertUsuario.rows[0]?.id ?? null;
          portalCredentials = { email: sol.email, tempPassword };
        } catch (e) {
          // Best-effort: si falla, no abortamos la aprobacion. Se puede crear manualmente despues.
          console.warn("[solicitudes-acceso] no se pudo crear auth user:", e instanceof Error ? e.message : e);
        }
      }

      const upd = await client.query<{ id: string }>(
        `UPDATE ${t("solicitudes_acceso")}
            SET estado='aprobada', resultado_id=$3::uuid,
                revisado_por=$4::uuid, revisado_at=now()
          WHERE empresa_id=$1::uuid AND id=$2::uuid
          RETURNING id`,
        [ALQUILOYA_EMPRESA_ID, id, resultadoId, user.id]
      );

      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        id: upd.rows[0].id,
        estado: "aprobada",
        resultado_id: resultadoId,
        tipo: sol.tipo,
        portal_credentials: portalCredentials, // {email, tempPassword} | null
        usuario_erp_id: usuarioErpId,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[api/dashboard/alquiloya-solicitudes-acceso/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
