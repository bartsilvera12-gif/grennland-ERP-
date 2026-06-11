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
      // 1) Path normal: usuarios.propietario_id linkeado a propietarios.id
      const { data: uExt } = await supabase
        .from("usuarios")
        .select("propietario_id, email")
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

      // 2) Fallback: si no hay linkage en usuarios.propietario_id, buscar
      // propietarios con el mismo email del auth user. Cubre el caso donde el
      // propietario fue cargado en alquiloya.propietarios pero usuarios.propietario_id
      // quedo NULL (por ej. alta manual, o auth.users creado despues que el
      // propietario). Al encontrar match, auto-vinculamos para que la proxima
      // request use el path rapido.
      if (!propietario) {
        const candidateEmails = [
          (uExt as { email?: string | null } | null)?.email ?? null,
          user.email ?? null,
        ].filter((e): e is string => typeof e === "string" && e.trim().length > 0);
        for (const em of candidateEmails) {
          const { data: pr } = await supabase
            .from("propietarios")
            .select("id, nombre, email, telefono, tipo_persona, estado, activo, plan_publicacion_id, plan_vencimiento_at, impulsos_saldo")
            .ilike("email", em.trim())
            .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
            .limit(1)
            .maybeSingle();
          if (pr) {
            propietario = pr as Record<string, unknown>;
            const prId = (pr as { id?: string }).id;
            if (prId) {
              await supabase
                .from("usuarios")
                .update({ propietario_id: prId })
                .eq("id", usuario.id);
            }
            break;
          }
        }
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

/**
 * PATCH /api/propietario/me
 *
 * Edicion del propietario autenticado: nombre y telefono. El email no es
 * editable por aca (se cambia desde auth.users via flujo aparte).
 */
export async function PATCH(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== ALQUILOYA_EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no autorizado" }, { status: 403 });
    }
    const { data: uExt } = await supabase
      .from("usuarios")
      .select("propietario_id")
      .eq("id", usuario.id)
      .limit(1)
      .maybeSingle();
    const propietarioId = (uExt as { propietario_id?: string | null } | null)?.propietario_id ?? null;
    if (!propietarioId) return NextResponse.json({ error: "Sin perfil de propietario" }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    function clean(v: unknown, max = 200): string | null | undefined {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (typeof v !== "string") return undefined;
      const x = v.trim();
      if (!x) return null;
      return x.slice(0, max);
    }
    const patch: Record<string, unknown> = {};
    const nombre = clean(body.nombre, 160);
    if (nombre !== undefined) {
      if (nombre === null) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
      patch.nombre = nombre;
    }
    const telefono = clean(body.telefono, 40);
    if (telefono !== undefined) patch.telefono = telefono;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    const { data: updated, error: updErr } = await supabase
      .from("propietarios")
      .update(patch)
      .eq("id", propietarioId)
      .eq("empresa_id", ALQUILOYA_EMPRESA_ID)
      .select("id, nombre, email, telefono")
      .limit(1)
      .maybeSingle();
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ success: true, propietario: updated });
  } catch (err) {
    console.error("[api/propietario/me PATCH]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
