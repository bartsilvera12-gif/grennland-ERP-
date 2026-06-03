import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Kind = "cambio_plan" | "impulsos" | "verificacion";

function s(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  if (!x) return null;
  return x.slice(0, max);
}
function uuid(v: unknown): string | null {
  const x = s(v, 40);
  return x && uuidRe.test(x) ? x : null;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : null;
}
function int(v: unknown): number | null {
  const x = num(v);
  return x == null ? null : Math.trunc(x);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const kindRaw = s(body.kind, 20);
    if (kindRaw !== "cambio_plan" && kindRaw !== "impulsos" && kindRaw !== "verificacion") {
      return NextResponse.json(errorResponse("kind invalido"), { status: 400 });
    }
    const kind = kindRaw as Kind;

    const nombre = s(body.nombre, 160);
    const email = s(body.email, 160);
    const telefono = s(body.telefono, 40);
    if (!nombre) return NextResponse.json(errorResponse("nombre requerido"), { status: 400 });
    if (!email && !telefono) {
      return NextResponse.json(errorResponse("ingresá email o telefono"), { status: 400 });
    }

    let planTier: string | null = null;
    let packId: string | null = null;
    let packQty: number | null = null;
    let monto: number | null = num(body.monto);
    let propiedadId: string | null = null;
    const mensaje = s(body.mensaje, 1200);

    if (kind === "cambio_plan") {
      planTier = s(body.plan_tier, 40);
      if (!planTier) return NextResponse.json(errorResponse("plan_tier requerido"), { status: 400 });
    }
    if (kind === "impulsos") {
      packId = s(body.pack_id, 40);
      packQty = int(body.pack_qty);
      if (!packId || !packQty || packQty <= 0) {
        return NextResponse.json(errorResponse("pack_id y pack_qty requeridos"), { status: 400 });
      }
    }
    if (kind === "verificacion") {
      propiedadId = uuid(body.propiedad_id);
      // propiedad_id puede ser null si el usuario aún no la registró; el ERP la vincula al revisar.
    }

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });

    const { rows } = await queryWithRetry<{ id: string }>(
      pool,
      `INSERT INTO "alquiloya"."solicitudes_servicio"
         (empresa_id, kind, nombre, email, telefono,
          propiedad_id, plan_tier, pack_id, pack_qty, monto, mensaje, estado)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendiente')
       RETURNING id`,
      [
        ALQUILOYA_EMPRESA_ID, kind, nombre, email, telefono,
        propiedadId, planTier, packId, packQty, monto, mensaje,
      ]
    );
    return NextResponse.json(successResponse({ id: rows[0].id }));
  } catch (err) {
    console.error(
      "[api/public/alquiloya/solicitudes-servicio POST]",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(errorResponse("No se pudo registrar la solicitud"), { status: 500 });
  }
}
