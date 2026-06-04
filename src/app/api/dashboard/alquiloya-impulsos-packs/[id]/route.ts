import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function s(v: unknown, max = 80): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  return x ? x.slice(0, max) : null;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : null;
}
function b(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
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
    function push(col: string, val: unknown) { vals.push(val); sets.push(`${col} = $${vals.length}`); }

    if ("codigo" in body) { const v = s(body.codigo, 40); if (v) push("codigo", v); }
    if ("qty" in body) { const v = num(body.qty); if (v != null) push("qty", Math.trunc(v)); }
    if ("precio" in body) { const v = num(body.precio); if (v != null) push("precio", v); }
    if ("moneda" in body) { const v = s(body.moneda, 8); if (v) push("moneda", v); }
    if ("badge" in body) {
      const v = s(body.badge, 20);
      push("badge", v === "popular" || v === "best" ? v : null);
    }
    if ("orden" in body) { const v = num(body.orden); if (v != null) push("orden", Math.trunc(v)); }
    if ("activo" in body) { const v = b(body.activo); if (v !== undefined) push("activo", v); }

    if (sets.length === 0) return NextResponse.json({ error: "sin cambios" }, { status: 400 });

    vals.push(ALQUILOYA_EMPRESA_ID, id);
    const sql = `UPDATE "alquiloya"."impulsos_packs" SET ${sets.join(", ")}, updated_at = now()
                  WHERE empresa_id = $${vals.length - 1}::uuid AND id = $${vals.length}::uuid
                  RETURNING id`;
    const r = await queryWithRetry<{ id: string }>(pool, sql, vals);
    if (!r.rows[0]) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-impulsos-packs/[id] PATCH]", err);
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
      `DELETE FROM "alquiloya"."impulsos_packs"
        WHERE empresa_id = $1::uuid AND id = $2::uuid RETURNING id`,
      [ALQUILOYA_EMPRESA_ID, id]
    );
    if (!r.rows[0]) return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, id: r.rows[0].id });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-impulsos-packs/[id] DELETE]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
