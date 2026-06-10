import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

/**
 * GET /api/agente/captaciones
 * Devuelve las captaciones del agente logueado.
 * Resuelve auth.users → alquiloya.usuarios → agente_id, y filtra por ese agente_id.
 *
 * 200 { success, captaciones: [...] }
 * 401 sin sesión
 * 403 si la cuenta no está vinculada a un agente AlquiloYa
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no AlquiloYa" }, { status: 403 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    // agente_id desde alquiloya.usuarios (la resolver no la trae)
    const uExt = await queryWithRetry<{ agente_id: string | null }>(
      pool,
      `SELECT agente_id FROM alquiloya.usuarios WHERE id=$1::uuid LIMIT 1`,
      [usuario.id]
    );
    const agenteId = uExt.rows?.[0]?.agente_id ?? null;
    if (!agenteId) {
      return NextResponse.json({ error: "Cuenta sin agente vinculado" }, { status: 403 });
    }

    const r = await queryWithRetry(
      pool,
      `SELECT id, propietario_nombre, propietario_email, propietario_telefono,
              propiedad_titulo, tipo_propiedad, ciudad, barrio, direccion,
              precio_estimado::float8 AS precio_estimado,
              mensaje, etapa, estado, origen,
              created_at::text AS created_at,
              updated_at::text AS updated_at
         FROM alquiloya.agente_captaciones
        WHERE empresa_id=$1::uuid AND agente_id=$2::uuid
        ORDER BY created_at DESC
        LIMIT 200`,
      [ALQUILOYA_EMPRESA_ID, agenteId]
    );

    return NextResponse.json({ success: true, captaciones: r.rows ?? [] });
  } catch (err) {
    console.error("[api agente/captaciones GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x.length > 0 ? x : null;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

type PostBody = {
  propietario_nombre?: string;
  propietario_email?: string;
  propietario_telefono?: string;
  propiedad_titulo?: string;
  tipo_propiedad?: string;
  ciudad?: string;
  barrio?: string;
  direccion?: string;
  precio_estimado?: number | string;
  mensaje?: string;
};

/**
 * POST /api/agente/captaciones
 * Captacion creada por el agente desde su panel ("Captar propietario nuevo").
 * Inserta en alquiloya.agente_captaciones con agente_id = el del usuario logueado,
 * etapa='prospecto', origen='panel_agente'.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no AlquiloYa" }, { status: 403 });
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const uExt = await queryWithRetry<{ agente_id: string | null }>(
      pool,
      `SELECT agente_id FROM alquiloya.usuarios WHERE id=$1::uuid LIMIT 1`,
      [usuario.id]
    );
    const agenteId = uExt.rows?.[0]?.agente_id ?? null;
    if (!agenteId) {
      return NextResponse.json({ error: "Cuenta sin agente vinculado" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as PostBody;
    const nombre = s(body.propietario_nombre);
    if (!nombre) {
      return NextResponse.json({ error: "Nombre del propietario requerido" }, { status: 400 });
    }
    const email = s(body.propietario_email);
    const telefono = s(body.propietario_telefono);
    if (!email && !telefono) {
      return NextResponse.json(
        { error: "Necesitas email o telefono del propietario" },
        { status: 400 }
      );
    }

    const ins = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO alquiloya.agente_captaciones (
         empresa_id, agente_id, propietario_nombre, propietario_email, propietario_telefono,
         propiedad_titulo, tipo_propiedad, ciudad, barrio, direccion,
         precio_estimado, mensaje, origen, etapa
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        ALQUILOYA_EMPRESA_ID,
        agenteId,
        nombre,
        email,
        telefono,
        s(body.propiedad_titulo),
        s(body.tipo_propiedad),
        s(body.ciudad),
        s(body.barrio),
        s(body.direccion),
        num(body.precio_estimado),
        s(body.mensaje),
        "panel_agente",
        "prospecto",
      ]
    );

    return NextResponse.json({ success: true, id: ins.rows[0].id });
  } catch (err) {
    console.error("[api agente/captaciones POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
