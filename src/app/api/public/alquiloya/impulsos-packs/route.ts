import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getClientSchema, getClientEmpresaId } from "@/lib/env/instance-mode";

const SCHEMA = getClientSchema();

export const runtime = "nodejs";
// Cache 60s â€” los packs cambian con baja frecuencia, no necesitan tiempo real.
export const revalidate = 60;

const EMPRESA_ID = getClientEmpresaId();

export async function GET() {
  try {
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });
    const { rows } = await queryWithRetry(
      pool,
      `SELECT id, codigo, qty, precio::float8 AS precio, moneda, badge, orden
         FROM "${SCHEMA}"."impulsos_packs"
        WHERE empresa_id = $1::uuid AND activo = true
        ORDER BY orden ASC, qty ASC`,
      [EMPRESA_ID]
    );
    return NextResponse.json(successResponse({ packs: rows ?? [] }));
  } catch (err) {
    console.error("[api/public/alquiloya/impulsos-packs]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar los packs"), { status: 500 });
  }
}
