import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

/**
 * GET /api/agente/me
 *
 * Resuelve la sesión Supabase del navegador a una fila de `alquiloya.usuarios`
 * y, si tiene `agente_id`, devuelve también el perfil público del agente
 * (`alquiloya.agentes`). Pensado para reemplazar el hardcode `AG-001` del
 * panel `/publico#admin-agent`.
 *
 * Responses:
 *   200 { agente, usuario }  → usuario con agente_id vinculado
 *   200 { agente: null, usuario } → usuario válido pero sin agente_id
 *   401 { error: "No autenticado" }
 *   404 { error: "Usuario no resuelto" }
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no resuelto" }, { status: 404 });
    }

    // Solo resolvemos perfil agente si el usuario pertenece a AlquiloYa.
    let agente: Record<string, unknown> | null = null;
    if (usuario.empresa_id === ALQUILOYA_EMPRESA_ID) {
      // Lectura directa de `usuarios.agente_id` (resolver no la trae).
      const { data: uExt } = await supabase
        .from("usuarios")
        .select("agente_id")
        .eq("id", usuario.id)
        .limit(1)
        .maybeSingle();
      const agenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;
      if (agenteId) {
        const { data: ag } = await supabase
          .from("agentes")
          .select("id, nombre, email, telefono, whatsapp, foto_url, cargo, bio, orden, activo")
          .eq("id", agenteId)
          .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
          .limit(1)
          .maybeSingle();
        if (ag) agente = ag as Record<string, unknown>;
      }
    }

    return NextResponse.json({
      success: true,
      usuario: {
        id: usuario.id,
        empresa_id: usuario.empresa_id,
        rol: usuario.rol,
      },
      agente,
    });
  } catch (err) {
    console.error("[api/agente/me]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
