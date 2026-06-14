import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { readAvatarFile, uploadAvatar, extForMime } from "@/lib/alquiloya/avatar-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

/**
 * POST /api/agente/me/foto
 *
 * Sube/cambia la foto de perfil del agente autenticado. Multipart con campo
 * `file`. Guarda la imagen en el bucket público `avatars` y persiste la URL en
 * `alquiloya.agentes.foto_url`. Devuelve `{ success, foto_url }`.
 */
export async function POST(request: Request) {
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
      .select("agente_id")
      .eq("id", usuario.id)
      .limit(1)
      .maybeSingle();
    const agenteId = (uExt as { agente_id?: string | null } | null)?.agente_id ?? null;
    if (!agenteId) return NextResponse.json({ error: "Sin perfil de agente" }, { status: 404 });

    const form = await request.formData().catch(() => null);
    const parsed = await readAvatarFile(form?.get("file"));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

    const objectPath = `agentes/${ALQUILOYA_EMPRESA_ID}/${agenteId}.${extForMime(parsed.mime)}`;
    const fotoUrl = await uploadAvatar(supabase, objectPath, parsed.bytes, parsed.mime);

    const { error: updErr } = await supabase
      .from("agentes")
      .update({ foto_url: fotoUrl })
      .eq("id", agenteId)
      .eq("empresa_id", ALQUILOYA_EMPRESA_ID);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ success: true, foto_url: fotoUrl });
  } catch (err) {
    console.error("[api/agente/me/foto POST]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error al subir la foto" }, { status: 500 });
  }
}
