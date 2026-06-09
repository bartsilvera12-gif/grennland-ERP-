import { getClientSchema, isSingleClientMode } from "@/lib/env/instance-mode";
import PlanesLegacyClient from "./PlanesLegacyClient";
import PlanesAlquiloyaShell from "./PlanesAlquiloyaShell";

export const dynamic = "force-dynamic";

/**
 * Para instancias monocliente AlquiloYa, /planes es ahora una pantalla
 * unificada con tabs (Planes de publicación / Packs de impulsos) — a pedido
 * del cliente, ambos módulos conviven en la misma URL. Para el resto de
 * clientes sigue funcionando el editor legado de planes ERP.
 */
export default function PlanesPage() {
  if (isSingleClientMode() && getClientSchema() === "alquiloya") {
    return <PlanesAlquiloyaShell />;
  }
  return <PlanesLegacyClient />;
}
