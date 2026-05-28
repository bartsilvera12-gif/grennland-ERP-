import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = "alquiloya";
const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
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
        ALQUILOYA_EMPRESA_ID,
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
