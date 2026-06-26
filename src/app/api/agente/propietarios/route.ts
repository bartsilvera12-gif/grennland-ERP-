import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getClientSchema, getClientEmpresaId } from "@/lib/env/instance-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_SCHEMA = getClientSchema();
const EMPRESA_ID = getClientEmpresaId();

function t(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

/**
 * GET /api/agente/propietarios?q=texto
 *
 * Lista propietarios cargados en alquiloya.propietarios para que el agente
 * pueda seleccionarlos al captar (en vez de tipear los datos de cero).
 * Requiere sesion de agente.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no resuelto" }, { status: 404 });
    }
    // Solo agentes pueden listar propietarios para captar.
    const { data: uExt } = await supabase
      .from("usuarios")
      .select("agente_id")
      .eq("id", usuario.id)
      .limit(1)
      .maybeSingle();
    const agenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;
    if (!agenteId) {
      return NextResponse.json({ error: "Solo agentes pueden listar propietarios" }, { status: 403 });
    }

    const url = new URL(request.url);
    const qRaw = url.searchParams.get("q") ?? "";
    const q = qRaw.trim().toLowerCase();

    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json({ error: "Pool no disponible" }, { status: 500 });

    if (q) {
      // BÃºsqueda por nombre, email o telefono. Limitamos a 30.
      const like = `%${q}%`;
      const { rows } = await queryWithRetry(
        pool,
        `SELECT id, nombre, email, telefono, ciudad, tipo_persona
           FROM ${t("propietarios")}
          WHERE empresa_id = $1::uuid
            AND activo = true
            AND (
              lower(nombre)   LIKE $2 OR
              lower(coalesce(email, '')) LIKE $2 OR
              lower(coalesce(telefono, '')) LIKE $2
            )
          ORDER BY lower(nombre) ASC
          LIMIT 30`,
        [EMPRESA_ID, like]
      );
      return NextResponse.json({ success: true, propietarios: rows ?? [] });
    }

    // Sin query, devolvemos los 30 mÃ¡s recientes para mostrar algo en el dropdown.
    const { rows } = await queryWithRetry(
      pool,
      `SELECT id, nombre, email, telefono, ciudad, tipo_persona
         FROM ${t("propietarios")}
        WHERE empresa_id = $1::uuid AND activo = true
        ORDER BY created_at DESC NULLS LAST, lower(nombre) ASC
        LIMIT 30`,
      [EMPRESA_ID]
    );
    return NextResponse.json({ success: true, propietarios: rows ?? [] });
  } catch (err) {
    console.error("[api/agente/propietarios]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
