import { listPublicAgentes } from "@/lib/alquiloya/public-api";

export const runtime = "nodejs";
// Sin cache: cuando un agente sube/cambia su foto desde su panel (POST
// /api/agente/me/foto) o el admin edita el perfil, queremos que el listado
// publico ("Solicitar agente") refleje el cambio de inmediato. Antes había
// `revalidate = 60` y la foto recien asignada no aparecia hasta un minuto
// despues.
export const dynamic = "force-dynamic";

export async function GET() {
  return listPublicAgentes();
}
