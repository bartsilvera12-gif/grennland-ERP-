import type { ErpAgenteAccesoUsuario } from "@/lib/alquiloya/erp-agentes-inmobiliarios";

/**
 * Bloque "Acceso al portal" del detalle de Agente / Propietario.
 * Por ahora solo lectura: si hay usuario vinculado lo muestra, si no
 * ofrece un botón visual "Crear acceso" deshabilitado (la creación real
 * de `auth.users` se hace en una fase aparte).
 */
export function AccesoBlock({ acceso }: { acceso: ErpAgenteAccesoUsuario | null }) {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">
        Acceso al portal
      </h2>

      {acceso ? (
        <div className="space-y-2 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email</div>
            <div className="text-slate-800">{acceso.email ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rol</div>
            <div className="text-slate-800">{acceso.rol ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</div>
            <div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                  acceso.activo
                    ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {acceso.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Sin acceso creado.</p>
          <button
            type="button"
            disabled
            title="Disponible en la próxima fase"
            className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-400 ring-1 ring-slate-200"
          >
            Crear acceso · próxima fase
          </button>
        </div>
      )}
    </aside>
  );
}
