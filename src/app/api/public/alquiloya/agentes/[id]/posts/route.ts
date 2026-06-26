import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getClientSchema, getClientEmpresaId } from "@/lib/env/instance-mode";

const SCHEMA = getClientSchema();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPRESA_ID = getClientEmpresaId();
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!uuidRe.test(id)) {
      return NextResponse.json(errorResponse("id invalido"), { status: 400 });
    }
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });

    const { rows } = await queryWithRetry(
      pool,
      `SELECT id, slug, titulo, resumen, contenido, cover_url,
              destacado, orden,
              publicado_at::text AS publicado_at
         FROM "${SCHEMA}"."agente_posts"
        WHERE empresa_id = $1::uuid
          AND agente_id = $2::uuid
          AND publicado = true
        ORDER BY destacado DESC, orden ASC, publicado_at DESC NULLS LAST
        LIMIT 24`,
      [EMPRESA_ID, id]
    );
    return NextResponse.json(successResponse({ posts: rows ?? [] }));
  } catch (err) {
    console.error("[api/public/alquiloya/agentes/[id]/posts]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar los posts"), { status: 500 });
  }
}
