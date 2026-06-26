import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { listErpTestimonios } from "@/lib/alquiloya/erp-testimonios";
import { getClientSchema, getClientEmpresaId } from "@/lib/env/instance-mode";

const SCHEMA = getClientSchema();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPRESA_ID = getClientEmpresaId();

function s(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}
function b(v: unknown, def: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return def;
}
function i(v: unknown, def: number, min: number, max: number): number {
  if (v == null || v === "") return def;
  const x = Number(v);
  if (!Number.isFinite(x)) return def;
  const t = Math.trunc(x);
  return Math.min(max, Math.max(min, t));
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const rows = await listErpTestimonios();
    return NextResponse.json({ success: true, data: { testimonios: rows } });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-testimonios GET]", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const autor = s(body.autor, 160);
    const contenido = s(body.contenido, 2000);
    if (!autor) return NextResponse.json({ error: "autor requerido" }, { status: 400 });
    if (!contenido) return NextResponse.json({ error: "contenido requerido" }, { status: 400 });

    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO "${SCHEMA}"."testimonios"
         (empresa_id, autor, rol, ciudad, contenido, foto_url, calificacion, orden, activo, destacado)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        EMPRESA_ID,
        autor,
        s(body.rol, 80),
        s(body.ciudad, 80),
        contenido,
        s(body.foto_url, 500),
        i(body.calificacion, 5, 1, 5),
        i(body.orden, 0, 0, 9999),
        b(body.activo, true),
        b(body.destacado, false),
      ]
    );
    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-testimonios POST]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
