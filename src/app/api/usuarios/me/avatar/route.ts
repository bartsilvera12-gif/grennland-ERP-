import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { readAvatarFile, uploadAvatar, extForMime } from "@/lib/alquiloya/avatar-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/usuarios/me/avatar
 *
 * Sube/cambia la foto de perfil del usuario interno del ERP autenticado.
 * Multipart con campo `file`. Guarda en el bucket público `avatars` y persiste
 * la URL en `usuarios.avatar_url`. Devuelve `{ success, avatar_url }`.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario?.id) {
      return NextResponse.json({ error: "Usuario no resuelto" }, { status: 404 });
    }

    const form = await request.formData().catch(() => null);
    const parsed = await readAvatarFile(form?.get("file"));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

    const objectPath = `usuarios/${usuario.id}.${extForMime(parsed.mime)}`;
    const avatarUrl = await uploadAvatar(supabase, objectPath, parsed.bytes, parsed.mime);

    const { error: updErr } = await supabase
      .from("usuarios")
      .update({ avatar_url: avatarUrl })
      .eq("id", usuario.id);
    if (updErr) {
      const msg = /avatar_url/i.test(updErr.message)
        ? "Falta aplicar la migración de avatar_url en la base de datos."
        : updErr.message;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ success: true, avatar_url: avatarUrl });
  } catch (err) {
    console.error("[api/usuarios/me/avatar POST]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error al subir la foto" }, { status: 500 });
  }
}
