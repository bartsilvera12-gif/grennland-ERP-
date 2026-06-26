import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { getClientSchema, getClientEmpresaId } from "@/lib/env/instance-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = getClientSchema();
const EMPRESA_ID = getClientEmpresaId();
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}
function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x.length > 0 ? x : null;
}
function b(v: unknown, def: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return def;
}

type PostBody = {
  nombre?: string;
  email?: string | null;
  telefono?: string | null;
  documento?: string | null;
  tipo_persona?: string | null;
  estado?: string | null;
  activo?: boolean;
  plan_publicacion_id?: string | null;
  observaciones?: string | null;
};

/**
 * GET /api/dashboard/alquiloya-propietarios?q=<search>
 * Listado simple para selector del form de propiedades. Devuelve los
 * propietarios activos, busca por nombre/email/telefono si llega ?q.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);

    let sql = `SELECT id, nombre, email, telefono, telefono_contacto, documento, observaciones
                 FROM ${t("propietarios")}
                WHERE empresa_id = $1::uuid AND activo = true`;
    const params: unknown[] = [EMPRESA_ID];
    if (q.length >= 1) {
      params.push(`%${q}%`);
      sql += ` AND (nombre ILIKE $2 OR email ILIKE $2 OR telefono ILIKE $2)`;
    }
    sql += ` ORDER BY nombre ASC LIMIT ${limit}`;

    const { rows } = await queryWithRetry<{
      id: string;
      nombre: string;
      email: string | null;
      telefono: string | null;
      telefono_contacto: string | null;
      documento: string | null;
      observaciones: string | null;
    }>(pool, sql, params);
    return NextResponse.json({ success: true, data: { propietarios: rows } });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-propietarios GET]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudieron cargar los propietarios" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as PostBody;
    const nombre = s(body.nombre);
    if (!nombre) return NextResponse.json({ error: "nombre requerido" }, { status: 400 });

    const planId = s(body.plan_publicacion_id);
    if (planId && !uuidRe.test(planId)) {
      return NextResponse.json({ error: "plan_publicacion_id invalido" }, { status: 400 });
    }

    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO ${t("propietarios")} (
         empresa_id, nombre, email, telefono, documento, tipo_persona,
         estado, activo, plan_publicacion_id, observaciones
       )
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10)
       RETURNING id`,
      [
        EMPRESA_ID,
        nombre,
        s(body.email),
        s(body.telefono),
        s(body.documento),
        s(body.tipo_persona),
        s(body.estado),
        b(body.activo, true),
        planId,
        s(body.observaciones),
      ]
    );
    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-propietarios POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
