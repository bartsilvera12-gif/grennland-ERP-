import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";
import { getAuthUserForApiRoute } from "@/lib/auth/get-auth-user-for-api-route";
import { resolveUsuarioErpFromAuthUser } from "@/lib/auth/resolve-usuario-erp";
import { readAvatarFile, uploadAvatar, extForMime } from "@/lib/alquiloya/avatar-storage";
import { getClientEmpresaId } from "@/lib/env/instance-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPRESA_ID = getClientEmpresaId();

/**
 * POST /api/dashboard/alquiloya-agentes/foto-upload
 *
 * Sube una foto de agente al bucket `avatars` desde el ERP. Pensado para el
 * formulario "Nuevo agente" donde todavia no existe `agente_id`. El admin
 * sube la imagen, recibe la URL publica y la pega en `foto_url` antes de
 * crear/actualizar la fila. La autenticacion es la del ERP (cookie Supabase
 * â†’ resolveUsuarioErpFromAuthUser) y exige pertenecer a la empresa AlquiloYa.
 *
 * Body: multipart/form-data con campo `file`.
 * Response: { success, foto_url } | { error }
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUserForApiRoute(request);
    if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const supabase = createServiceRoleClient();
    const usuario = await resolveUsuarioErpFromAuthUser(supabase, user);
    if (!usuario || usuario.empresa_id !== EMPRESA_ID) {
      return NextResponse.json({ error: "Usuario no autorizado" }, { status: 403 });
    }

    const form = await request.formData().catch(() => null);
    const parsed = await readAvatarFile(form?.get("file"));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

    // Path generico para el ERP: separamos en `uploads/<uuid>.<ext>` para no
    // pisar el path por-agente (`agentes/<empresa>/<agente_id>.<ext>`) que usa
    // el panel del agente logueado. El cache-buster se agrega en uploadAvatar.
    const objectPath = `agentes/${EMPRESA_ID}/uploads/${randomUUID()}.${extForMime(parsed.mime)}`;
    const fotoUrl = await uploadAvatar(supabase, objectPath, parsed.bytes, parsed.mime);

    return NextResponse.json({ success: true, foto_url: fotoUrl });
  } catch (err) {
    console.error("[api/dashboard/alquiloya-agentes/foto-upload POST]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error al subir la foto" }, { status: 500 });
  }
}
