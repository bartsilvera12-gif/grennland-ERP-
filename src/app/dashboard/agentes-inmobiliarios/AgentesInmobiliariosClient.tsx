"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import type {
  ErpAgenteInmobiliarioRow,
  ErpPropietarioRow,
} from "@/lib/alquiloya/erp-agentes-inmobiliarios";

type Tab = "agentes" | "propietarios";

function Badge({ on, label }: { on: boolean | null; label: string }) {
  const isOn = !!on;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        isOn
          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
      }`}
    >
      {label}
    </span>
  );
}

export function AgentesInmobiliariosClient({
  agentes,
  propietarios,
  agentesError,
  propietariosError,
}: {
  agentes: ErpAgenteInmobiliarioRow[];
  propietarios: ErpPropietarioRow[];
  agentesError: string | null;
  propietariosError: string | null;
}) {
  const [tab, setTab] = useState<Tab>("agentes");

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-200">
        <nav className="-mb-px flex gap-1" aria-label="Pestañas">
          <TabButton active={tab === "agentes"} onClick={() => setTab("agentes")}>
            Agentes inmobiliarios
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {agentes.length}
            </span>
          </TabButton>
          <TabButton active={tab === "propietarios"} onClick={() => setTab("propietarios")}>
            Propietarios
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {propietarios.length}
            </span>
          </TabButton>
        </nav>
        <div className="mb-2 flex items-center gap-2">
          {tab === "agentes" ? (
            <Link
              href="/dashboard/agentes-inmobiliarios/agentes/nuevo"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91]"
            >
              + Nuevo agente
            </Link>
          ) : (
            <Link
              href="/dashboard/agentes-inmobiliarios/propietarios/nuevo"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91]"
            >
              + Nuevo propietario
            </Link>
          )}
        </div>
      </div>

      {tab === "agentes" ? (
        <AgentesTab rows={agentes} error={agentesError} />
      ) : (
        <PropietariosTab rows={propietarios} error={propietariosError} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "border-[#4FAEB2] text-[#3F8E91]"
          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function AgentesTab({
  rows,
  error,
}: {
  rows: ErpAgenteInmobiliarioRow[];
  error: string | null;
}) {
  const router = useRouter();
  const [showInactive, setShowInactive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const inactiveCount = useMemo(() => rows.filter((r) => !r.activo).length, [rows]);
  const visibleRows = useMemo(
    () => (showInactive ? rows : rows.filter((r) => r.activo)),
    [rows, showInactive]
  );

  async function toggleActivo(id: string, nombre: string | null, nextActivo: boolean) {
    const label = nombre?.trim() || "este agente";
    const msg = nextActivo
      ? `¿Reactivar a "${label}"? Volverá a aparecer en la web pública.`
      : `¿Desactivar a "${label}"?\n\nDejará de aparecer en la web pública. Sus captaciones y propiedades históricas se conservan.\nPodés reactivarlo cuando quieras.`;
    if (!window.confirm(msg)) return;
    setBusyId(id);
    try {
      const res = nextActivo
        ? await fetchWithSupabaseSession(`/api/dashboard/alquiloya-agentes/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activo: true }),
          })
        : await fetchWithSupabaseSession(`/api/dashboard/alquiloya-agentes/${id}`, {
            method: "DELETE",
          });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      window.alert(`No se pudo ${nextActivo ? "reactivar" : "desactivar"}: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        No se pudieron cargar los agentes: {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No hay agentes inmobiliarios cargados todavía.
      </div>
    );
  }
  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-3 text-sm">
        <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]"
          />
          Ver desactivados
          {inactiveCount > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {inactiveCount}
            </span>
          ) : null}
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Agente</th>
              <th className="hidden px-3 py-2.5 md:table-cell">Cargo</th>
              <th className="px-3 py-2.5">Teléfono</th>
              <th className="hidden px-3 py-2.5 lg:table-cell">Email</th>
              <th className="hidden px-3 py-2.5 text-center md:table-cell">Propiedades</th>
              <th className="px-3 py-2.5">Activo</th>
              <th className="sticky right-0 bg-slate-50 px-3 py-2.5 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                  No hay agentes activos. Activá &ldquo;Ver desactivados&rdquo; para verlos.
                </td>
              </tr>
            ) : (
              visibleRows.map((a) => {
                const dim = !a.activo;
                return (
                  <tr key={a.id} className={`hover:bg-slate-50 ${dim ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {a.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.foto_url}
                            alt={a.nombre ?? ""}
                            className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                            {(a.nombre ?? "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="font-medium text-slate-900">{a.nombre ?? "—"}</div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 text-slate-700 md:table-cell">{a.cargo ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{a.telefono ?? a.whatsapp ?? "—"}</td>
                    <td className="hidden px-3 py-2 text-slate-700 lg:table-cell">{a.email ?? "—"}</td>
                    <td className="hidden px-3 py-2 text-center text-slate-700 tabular-nums md:table-cell">
                      {a.propiedades_count}
                    </td>
                    <td className="px-3 py-2">
                      <Badge on={a.activo} label={a.activo ? "Sí" : "No"} />
                    </td>
                    <td className="sticky right-0 bg-white px-3 py-2 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/dashboard/agentes-inmobiliarios/agentes/${a.id}`}
                          className="inline-flex items-center rounded-md bg-[#4FAEB2]/10 px-2.5 py-1 text-xs font-medium text-[#3F8E91] ring-1 ring-[#4FAEB2]/30 hover:bg-[#4FAEB2]/20"
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/dashboard/agentes-inmobiliarios/agentes/${a.id}/editar`}
                          className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
                        >
                          Editar
                        </Link>
                        {a.activo ? (
                          <button
                            type="button"
                            onClick={() => toggleActivo(a.id, a.nombre, false)}
                            disabled={busyId === a.id}
                            className="inline-flex items-center rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
                          >
                            {busyId === a.id ? "…" : "Desactivar"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleActivo(a.id, a.nombre, true)}
                            disabled={busyId === a.id}
                            className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
                          >
                            {busyId === a.id ? "…" : "Reactivar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PropietariosTab({
  rows,
  error,
}: {
  rows: ErpPropietarioRow[];
  error: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        No se pudieron cargar los propietarios: {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        Todavía no hay propietarios registrados. Cuando se carguen propietarios
        externos (alquiloya.propietarios) aparecerán acá.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2.5">Nombre</th>
            <th className="px-3 py-2.5">Tipo</th>
            <th className="px-3 py-2.5">Documento</th>
            <th className="px-3 py-2.5">Teléfono</th>
            <th className="px-3 py-2.5">Email</th>
            <th className="px-3 py-2.5">Estado</th>
            <th className="px-3 py-2.5">Activo</th>
            <th className="px-3 py-2.5">Usuario</th>
            <th className="px-3 py-2.5">Plan</th>
            <th className="px-3 py-2.5 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-900">{p.nombre}</td>
              <td className="px-3 py-2 text-slate-700">{p.tipo_persona ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{p.documento ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{p.telefono ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{p.email ?? "—"}</td>
              <td className="px-3 py-2 text-slate-700">{p.estado ?? "—"}</td>
              <td className="px-3 py-2">
                <Badge on={p.activo} label={p.activo ? "Sí" : "No"} />
              </td>
              <td className="px-3 py-2 text-slate-500">
                {p.usuario_id ? <span className="text-emerald-700">vinculado</span> : "—"}
              </td>
              <td className="px-3 py-2 text-slate-500">
                {p.plan_publicacion_id ? <span className="text-emerald-700">asignado</span> : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="inline-flex items-center gap-1.5">
                  <Link
                    href={`/dashboard/agentes-inmobiliarios/propietarios/${p.id}`}
                    className="inline-flex items-center rounded-md bg-[#4FAEB2]/10 px-2.5 py-1 text-xs font-medium text-[#3F8E91] ring-1 ring-[#4FAEB2]/30 hover:bg-[#4FAEB2]/20"
                  >
                    Ver
                  </Link>
                  <Link
                    href={`/dashboard/agentes-inmobiliarios/propietarios/${p.id}/editar`}
                    className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
                  >
                    Editar
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
