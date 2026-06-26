import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getClientSchema, getClientEmpresaId } from "@/lib/env/instance-mode";

const SCHEMA = getClientSchema();

export const runtime = "nodejs";
// Cache 60s â€” los testimonios cambian con baja frecuencia.
export const revalidate = 60;

const EMPRESA_ID = getClientEmpresaId();

export async function GET() {
  try {
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });
    const { rows } = await queryWithRetry(
      pool,
      `SELECT id, autor, rol, ciudad, contenido, foto_url, calificacion, destacado
         FROM "${SCHEMA}"."testimonios"
        WHERE empresa_id = $1::uuid AND activo = true
        ORDER BY destacado DESC, orden ASC, created_at DESC NULLS LAST
        LIMIT 24`,
      [EMPRESA_ID]
    );
    return NextResponse.json(successResponse({ testimonios: rows ?? [] }));
  } catch (err) {
    console.error("[api/public/alquiloya/testimonios]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar los testimonios"), { status: 500 });
  }
}
