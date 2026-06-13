import {
  listErpAgentesInmobiliarios,
  type ErpAgenteInmobiliarioRow,
} from "@/lib/alquiloya/erp-agentes-inmobiliarios";
import { AgentesInmobiliariosClient } from "./AgentesInmobiliariosClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AgentesInmobiliariosPage() {
  let agentes: ErpAgenteInmobiliarioRow[] = [];
  let agentesError: string | null = null;

  try {
    agentes = await listErpAgentesInmobiliarios();
  } catch (e) {
    agentesError = e instanceof Error ? e.message : "Error desconocido";
    console.error("[dashboard/agentes-inmobiliarios] agentes", e);
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Agentes inmobiliarios
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestión de cuentas externas (agentes) que publican en AlquiloYa.
          Los propietarios publican sin cuenta y no requieren registro.
        </p>
      </header>

      <AgentesInmobiliariosClient agentes={agentes} agentesError={agentesError} />
    </div>
  );
}
