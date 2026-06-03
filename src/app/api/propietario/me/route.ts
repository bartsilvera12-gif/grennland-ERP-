import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

/**
 * GET /api/propietario/me
 *
 * Resuelve la sesion Supabase a alquiloya.usuarios y, si tiene propietario_id,
 * devuelve el perfil del propietario y su saldo de impulsos.
 *
 * Responses:
 *   200 { propietario, usuario }  -> usuario con propietario_id vinculado
 *   200 { propietario: null, usuario } -> usuario valido sin propietario_id
 *   401 / 404 -> error
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario) return NextResponse.json({ error: "Usuario no resuelto" }, { status: 404 });

    let propietario: Record<string, unknown> | null = null;
    if (usuario.empresa_id === ALQUILOYA_EMPRESA_ID) {
      const { data: uExt } = await supabase
        .from("usuarios")
        .select("propietario_id")
        .eq("id", usuario.id)
        .limit(1)
        .maybeSingle();
      const propietarioId = (uExt as { propietario_id?: string | null } | null)?.propietario_id ?? null;
      if (propietarioId) {
        const { data: pr } = await supabase
          .from("propietarios")
          .select("id, nombre, email, telefono, tipo_persona, estado, activo, plan_publicacion_id, plan_vencimiento_at, impulsos_saldo")
          .eq("id", propietarioId)
          .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
          .limit(1)
          .maybeSingle();
        if (pr) propietario = pr as Record<string, unknown>;
      }
    }

    return NextResponse.json({
      success: true,
      usuario: { id: usuario.id, empresa_id: usuario.empresa_id, rol: usuario.rol },
      propietario,
    });
  } catch (err) {
    console.error("[api/propietario/me]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
