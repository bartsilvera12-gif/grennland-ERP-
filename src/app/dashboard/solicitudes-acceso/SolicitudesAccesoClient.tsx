"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { SolicitudAccesoRow } from "@/lib/alquiloya/erp-solicitudes-acceso";
import { confirmDialog } from "@/lib/ui/dialogs";

type Filter = "todas" | "pendiente" | "aprobada" | "rechazada";
type TipoFilter = "todos" | "agente" | "propietario" | "referido_partner";

const TIPO_LABEL: Record<TipoFilter, string> = {
  todos: "Todos",
  agente: "Agentes",
  propietario: "Propietarios",
  referido_partner: "Referidos",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-PY", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function EstadoBadge({ estado }: { estado: SolicitudAccesoRow["estado"] }) {
  const map: Record<SolicitudAccesoRow["estado"], string> = {
    pendiente: "bg-amber-100 text-amber-700 ring-amber-200",
    aprobada: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    rechazada: "bg-rose-100 text-rose-700 ring-rose-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${map[estado]}`}>
      {estado}
    </span>
  );
}

function TipoBadge({ tipo, sub }: { tipo: SolicitudAccesoRow["tipo"]; sub: string | null }) {
  let label = "";
  let cls = "";
  if (tipo === "agente") {
    label = `Agente · ${sub ?? "—"}`;
    cls = "bg-[#4FAEB2]/10 text-[#3F8E91] ring-[#4FAEB2]/30";
  } else if (tipo === "propietario") {
    label = "Propietario";
    cls = "bg-indigo-100 text-indigo-700 ring-indigo-200";
  } else {
    label = sub ? `Referido · ${sub}` : "Referido";
    cls = "bg-amber-100 text-amber-700 ring-amber-200";
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cls}`}>
      {label}
    </span>
  );
}

export default function SolicitudesAccesoClient({
  initial,
}: {
  initial: SolicitudAccesoRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SolicitudAccesoRow[]>(initial);
  const [filter, setFilter] = useState<Filter>("pendiente");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "aprobar"; row: SolicitudAccesoRow }
    | { kind: "rechazar"; row: SolicitudAccesoRow; motivo: string }
    | null
  >(null);
  const [err, setErr] = useState<string | null>(null);

  // Counts cruzados: cada grupo de chips refleja lo que pasaria si lo
  // seleccionas considerando los OTROS filtros activos. Asi si "Agentes 1"
  // aparece, hacer click realmente muestra 1 (no 0 como cuando los counts
  // eran independientes).
  const matchesText = (r: SolicitudAccesoRow, q: string) => {
    if (!q) return true;
    return (
      (r.nombre ?? "").toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.telefono ?? "").toLowerCase().includes(q) ||
      (r.empresa ?? "").toLowerCase().includes(q) ||
      (r.ciudad ?? "").toLowerCase().includes(q)
    );
  };

  const counts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const c = { todas: 0, pendiente: 0, aprobada: 0, rechazada: 0 };
    for (const r of rows) {
      if (tipoFilter !== "todos" && r.tipo !== tipoFilter) continue;
      if (!matchesText(r, q)) continue;
      c.todas += 1;
      c[r.estado] += 1;
    }
    return c;
  }, [rows, tipoFilter, search]);

  const tipoCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const c: Record<TipoFilter, number> = {
      todos: 0,
      agente: 0,
      propietario: 0,
      referido_partner: 0,
    };
    for (const r of rows) {
      if (filter !== "todas" && r.estado !== filter) continue;
      if (!matchesText(r, q)) continue;
      c.todos += 1;
      c[r.tipo] += 1;
    }
    return c;
  }, [rows, filter, search]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "todas" && r.estado !== filter) return false;
      if (tipoFilter !== "todos" && r.tipo !== tipoFilter) return false;
      if (q) {
        const hay =
          (r.nombre ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          (r.telefono ?? "").toLowerCase().includes(q) ||
          (r.empresa ?? "").toLowerCase().includes(q) ||
          (r.ciudad ?? "").toLowerCase().includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [rows, filter, tipoFilter, search]);

  async function doAction(row: SolicitudAccesoRow, action: "aprobar" | "rechazar", motivo?: string) {
    setErr(null);
    setBusyId(row.id);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-solicitudes-acceso/${row.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, motivo_rechazo: motivo ?? null }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        estado?: SolicitudAccesoRow["estado"];
        resultado_id?: string | null;
        error?: string;
        portal_credentials?: { email: string; tempPassword: string } | null;
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (action === "aprobar" && data.portal_credentials) {
        const { email, tempPassword } = data.portal_credentials;
        // Usamos confirmDialog (con solo botón Aceptar) para que las
        // credenciales queden visibles hasta que el admin las copie.
        // Un toast desaparecería antes de que pueda copiarlas.
        await confirmDialog({
          title: "Cuenta del portal creada",
          message:
            `Email: ${email}\n` +
            `Contraseña temporal: ${tempPassword}\n\n` +
            `IMPORTANTE: copiá esta contraseña ahora y enviásela al usuario por WhatsApp. No se vuelve a mostrar.`,
          confirmText: "Listo, ya la copié",
          cancelText: "Cerrar",
          tone: "warning",
        });
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                estado: data.estado ?? r.estado,
                motivo_rechazo: action === "rechazar" ? motivo ?? null : r.motivo_rechazo,
                resultado_id: data.resultado_id ?? r.resultado_id,
                revisado_at: new Date().toISOString(),
              }
            : r
        )
      );
      setConfirm(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Estado</div>
        {(["pendiente", "aprobada", "rechazada", "todas"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
              filter === f
                ? "bg-[#4FAEB2] text-white ring-[#4FAEB2]"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span
              className={`rounded-full px-1.5 text-[10px] ${
                filter === f ? "bg-white/20" : "bg-slate-100 text-slate-500"
              }`}
            >
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tipo</div>
        {(["todos", "agente", "propietario", "referido_partner"] as TipoFilter[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipoFilter(t)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
              tipoFilter === t
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {TIPO_LABEL[t]}
            <span
              className={`rounded-full px-1.5 text-[10px] ${
                tipoFilter === t ? "bg-white/20" : "bg-slate-100 text-slate-500"
              }`}
            >
              {tipoCounts[t]}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre, email, teléfono, empresa o ciudad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Limpiar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {err ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {err}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No hay solicitudes en este estado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Solicitante</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Contacto</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Ciudad</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Empresa</th>
                <th className="px-3 py-2.5">Plan</th>
                <th className="hidden px-3 py-2.5 xl:table-cell">Recibida</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.nombre}</div>
                    {r.mensaje ? (
                      <div className="mt-0.5 line-clamp-2 max-w-xs text-[11px] text-slate-500">
                        {r.mensaje}
                      </div>
                    ) : null}
                    {r.motivo_rechazo && r.estado === "rechazada" ? (
                      <div className="mt-1 text-[11px] text-rose-600">
                        Rechazada: {r.motivo_rechazo}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2"><TipoBadge tipo={r.tipo} sub={r.sub_tipo} /></td>
                  <td className="hidden px-3 py-2 text-slate-700 md:table-cell">
                    <div>{r.email ?? "—"}</div>
                    <div className="text-[11px] text-slate-500">{r.telefono ?? ""}</div>
                  </td>
                  <td className="hidden px-3 py-2 text-slate-700 lg:table-cell">{r.ciudad ?? "—"}</td>
                  <td className="hidden px-3 py-2 text-slate-700 lg:table-cell">{r.empresa ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.plan_tier_solicitado ? (
                      <span className="inline-flex flex-col">
                        <span className="font-medium text-slate-900">{r.plan_nombre_solicitado ?? r.plan_tier_solicitado}</span>
                        {r.plan_nombre_solicitado ? (
                          <span className="text-[10px] text-slate-400">{r.plan_tier_solicitado}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2 text-slate-500 xl:table-cell">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2"><EstadoBadge estado={r.estado} /></td>
                  <td className="px-3 py-2 text-right">
                    {r.estado === "pendiente" ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => setConfirm({ kind: "aprobar", row: r })}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => setConfirm({ kind: "rechazar", row: r, motivo: "" })}
                          className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">{fmtDate(r.revisado_at)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirm?.kind === "aprobar"}
        title="Aprobar solicitud"
        description={
          confirm?.kind === "aprobar" ? (
            confirm.row.tipo === "referido_partner" ? (
              <>
                Se creará un <strong>Referido</strong> en el programa para{" "}
                <strong>{confirm.row.nombre}</strong>
                {confirm.row.sub_tipo ? ` (canal: ${confirm.row.sub_tipo})` : ""} con:
                <br />
                <span className="text-slate-700">
                  · Link único auto-generado a partir del nombre
                  <br />
                  · Cookie de 60 días + atribución automática
                  <br />
                  · Comisión por defecto: <strong>10% recurrente por 12 meses</strong> (editable después)
                </span>
                <br />
                Si tiene email, también se crea su cuenta para entrar a{" "}
                <strong>/portal-referidos/dashboard</strong>.
              </>
            ) : (
              <>
                Se creará una cuenta en{" "}
                <strong>{confirm.row.tipo === "agente" ? "Agentes" : "Propietarios"}</strong> para{" "}
                <strong>{confirm.row.nombre}</strong>
                {confirm.row.tipo === "agente" && confirm.row.sub_tipo
                  ? ` (${confirm.row.sub_tipo})`
                  : ""}
                .
                {confirm.row.plan_tier_solicitado ? (
                  <>
                    <br />
                    {confirm.row.tipo === "propietario" ? (
                      <>
                        Se asignará el plan{" "}
                        <strong>
                          {confirm.row.plan_nombre_solicitado ?? confirm.row.plan_tier_solicitado}
                        </strong>{" "}
                        automáticamente.
                      </>
                    ) : (
                      <>
                        Plan solicitado:{" "}
                        <strong>
                          {confirm.row.plan_nombre_solicitado ?? confirm.row.plan_tier_solicitado}
                        </strong>{" "}
                        (los agentes no tienen plan asignado directo — quedará registrado en la solicitud).
                      </>
                    )}
                  </>
                ) : null}
              </>
            )
          ) : null
        }
        confirmLabel="Aprobar"
        busy={!!busyId}
        onConfirm={() => confirm?.kind === "aprobar" && doAction(confirm.row, "aprobar")}
        onCancel={() => setConfirm(null)}
      />

      {confirm?.kind === "rechazar" ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !busyId && setConfirm(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Rechazar solicitud</h3>
            <p className="mt-1 text-sm text-slate-600">
              Indicá un motivo (opcional) para <strong>{confirm.row.nombre}</strong>.
            </p>
            <textarea
              value={confirm.motivo}
              onChange={(e) =>
                setConfirm((c) => (c?.kind === "rechazar" ? { ...c, motivo: e.target.value } : c))
              }
              placeholder="Ej. Datos insuficientes, ya existe otra cuenta…"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              rows={3}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={!!busyId}
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!!busyId}
                onClick={() => doAction(confirm.row, "rechazar", confirm.motivo.trim() || undefined)}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {busyId ? "Procesando…" : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
