import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function s(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}
function b(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}
function i(v: unknown, min: number, max: number): number | undefined {
  if (v == null || v === "") return undefined;
  const x = Number(v);
  if (!Number.isFinite(x)) return undefined;
  const t = Math.trunc(x);
  return Math.min(max, Math.max(min, t));
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    function push(col: string, val: unknown) {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    }
    if ("autor" in body) {
      const v = s(body.autor, 160);
      if (!v) return NextResponse.json({ error: "autor vacio" }, { status: 400 });
      push("autor", v);
    }
    if ("rol" in body) push("rol", s(body.rol, 80));
    if ("ciudad" in body) push("ciudad", s(body.ciudad, 80));
    if ("contenido" in body) {
      const v = s(body.contenido, 2000);
      if (!v) return NextResponse.json({ error: "contenido vacio" }, { status: 400 });
      push("contenido", v);
    }
    if ("foto_url" in body) push("foto_url", s(body.foto_url, 500));
    if ("calificacion" in body) {
      const v = i(body.calificacion, 1, 5);
      if (v !== undefined) push("calificacion", v);
    }
    if ("orden" in body) {
      const v = i(body.orden, 0, 9999);
      if (v !== undefined) push("orden", v);
    }
    if ("activo" in body) {
      const v = b(body.activo);
      if (v !== undefined) push("activo", v);
    }
    if ("destacado" in body) {
      const v = b(body.destacado);
      if (v !== undefined) push("destacado", v);
    }
    if (sets.length === 0) return NextResponse.json({ error: "sin cambios" }, { status: 400 });

    vals.push(ALQUILOYA_EMPRESA_ID);
    vals.push(id);
    const sql = `UPDATE "alquiloya"."testimonios" SET ${sets.join(", ")}
                  WHERE empresa_id=$${vals.length - 1}::uuid AND id=$${vals.length}::uuid
                  RETURNING id`;
    const r = await queryWithRetry<{ id: string }>(pool, sql, vals);
    if (!r.rows || r.rows.length === 0) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-testimonios/[id] PATCH]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });
    const r = await queryWithRetry<{ id: string }>(
      pool,
      `DELETE FROM "alquiloya"."testimonios"
        WHERE empresa_id=$1::uuid AND id=$2::uuid
        RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (!r.rows || r.rows.length === 0) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-testimonios/[id] DELETE]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
