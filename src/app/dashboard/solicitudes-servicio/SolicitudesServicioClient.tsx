"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import type { SolicitudServicioRow } from "@/lib/alquiloya/erp-solicitudes-servicio";

type Filter = "todas" | "pendiente" | "aprobada" | "rechazada";
type PropOption = { id: string; nombre: string; email: string | null; telefono: string | null };

const KIND_LABEL: Record<SolicitudServicioRow["kind"], string> = {
  cambio_plan: "Cambio de plan",
  impulsos: "Compra de impulsos",
  verificacion: "Verificación de inmueble",
};

const KIND_CLS: Record<SolicitudServicioRow["kind"], string> = {
  cambio_plan: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  impulsos: "bg-amber-100 text-amber-800 ring-amber-300",
  verificacion: "bg-sky-100 text-sky-700 ring-sky-200",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-PY", { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}

function fmtGs(n: number | null): string {
  if (n == null) return "—";
  return "Gs. " + n.toLocaleString("es-PY");
}

function EstadoBadge({ estado }: { estado: SolicitudServicioRow["estado"] }) {
  const map: Record<SolicitudServicioRow["estado"], string> = {
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

export default function SolicitudesServicioClient({
  initial, propietarios,
}: {
  initial: SolicitudServicioRow[];
  propietarios: PropOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SolicitudServicioRow[]>(initial);
  const [filter, setFilter] = useState<Filter>("pendiente");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<
    | { kind: "aprobar"; row: SolicitudServicioRow; propietarioId: string; propiedadId: string }
    | { kind: "rechazar"; row: SolicitudServicioRow; motivo: string }
    | null
  >(null);

  const counts = useMemo(() => {
    const c = { todas: rows.length, pendiente: 0, aprobada: 0, rechazada: 0 };
    for (const r of rows) c[r.estado] += 1;
    return c;
  }, [rows]);
  const visible = useMemo(() => filter === "todas" ? rows : rows.filter((r) => r.estado === filter), [rows, filter]);

  // Auto-match propietario por email/teléfono al abrir el modal de aprobar.
  function suggestPropietario(row: SolicitudServicioRow): string {
    const byEmail = row.email ? propietarios.find((p) => p.email?.toLowerCase() === row.email!.toLowerCase()) : null;
    if (byEmail) return byEmail.id;
    const byTel = row.telefono ? propietarios.find((p) => p.telefono?.replace(/\s/g, "") === row.telefono!.replace(/\s/g, "")) : null;
    if (byTel) return byTel.id;
    return row.propietario_id ?? "";
  }

  async function aprobar() {
    if (!pending || pending.kind !== "aprobar") return;
    const row = pending.row;
    setBusyId(row.id); setErr(null);
    try {
      const body: Record<string, unknown> = { action: "aprobar" };
      if (row.kind === "cambio_plan" || row.kind === "impulsos") {
        if (!pending.propietarioId) throw new Error("Seleccioná un propietario");
        body.propietario_id = pending.propietarioId;
      }
      if (row.kind === "verificacion") {
        if (!pending.propiedadId) throw new Error("Pegá el UUID de la propiedad a verificar");
        body.propiedad_id = pending.propiedadId;
      }
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-solicitudes-servicio/${row.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, estado: "aprobada", revisado_at: new Date().toISOString() } : r));
      setPending(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally { setBusyId(null); }
  }

  async function rechazar() {
    if (!pending || pending.kind !== "rechazar") return;
    const row = pending.row;
    setBusyId(row.id); setErr(null);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-solicitudes-servicio/${row.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rechazar", motivo_rechazo: pending.motivo.trim() || null }) }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, estado: "rechazada", motivo_rechazo: pending.motivo.trim() || null, revisado_at: new Date().toISOString() } : r));
      setPending(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally { setBusyId(null); }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["pendiente","aprobada","rechazada","todas"] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
              filter === f ? "bg-[#4FAEB2] text-white ring-[#4FAEB2]" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className={`rounded-full px-1.5 text-[10px] ${filter === f ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {err ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div> : null}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">No hay solicitudes en este estado.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Solicitante</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Contacto</th>
                <th className="px-3 py-2.5">Detalle</th>
                <th className="hidden px-3 py-2.5 xl:table-cell">Recibida</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${KIND_CLS[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.nombre}</div>
                    {r.motivo_rechazo && r.estado === "rechazada" ? (
                      <div className="mt-1 text-[11px] text-rose-600">Rechazada: {r.motivo_rechazo}</div>
                    ) : null}
                  </td>
                  <td className="hidden px-3 py-2 text-slate-700 md:table-cell">
                    <div>{r.email ?? "—"}</div>
                    <div className="text-[11px] text-slate-500">{r.telefono ?? ""}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.kind === "cambio_plan" ? (
                      <>
                        <div className="font-medium text-slate-900">{r.plan_nombre ?? r.plan_tier}</div>
                        <div className="text-[11px] text-slate-400">{r.plan_tier}</div>
                      </>
                    ) : r.kind === "impulsos" ? (
                      <>
                        <div className="font-medium text-slate-900">{r.pack_qty ?? "?"} impulsos</div>
                        <div className="text-[11px] text-slate-500">{r.pack_id} · {fmtGs(r.monto)}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium text-slate-900">{r.propiedad_titulo ?? "—"}</div>
                        <div className="text-[11px] text-slate-400 break-all">{r.propiedad_id ?? "sin id"}</div>
                      </>
                    )}
                    {r.mensaje ? <div className="mt-1 line-clamp-2 max-w-xs text-[11px] text-slate-500">{r.mensaje}</div> : null}
                  </td>
                  <td className="hidden px-3 py-2 text-slate-500 xl:table-cell">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2"><EstadoBadge estado={r.estado} /></td>
                  <td className="px-3 py-2 text-right">
                    {r.estado === "pendiente" ? (
                      <div className="inline-flex items-center gap-1">
                        <button type="button" disabled={busyId === r.id}
                          onClick={() => setPending({ kind: "aprobar", row: r, propietarioId: suggestPropietario(r), propiedadId: r.propiedad_id ?? "" })}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Aprobar</button>
                        <button type="button" disabled={busyId === r.id}
                          onClick={() => setPending({ kind: "rechazar", row: r, motivo: "" })}
                          className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Rechazar</button>
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

      {pending?.kind === "aprobar" ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !busyId && setPending(null)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Aprobar {KIND_LABEL[pending.row.kind].toLowerCase()}</h3>
            <p className="mt-1 text-sm text-slate-600">Solicitante: <strong>{pending.row.nombre}</strong></p>

            {(pending.row.kind === "cambio_plan" || pending.row.kind === "impulsos") ? (
              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Propietario {pending.row.kind === "cambio_plan" ? "al que cambiar el plan" : "al que sumar los impulsos"}
                </label>
                <select value={pending.propietarioId}
                  onChange={(e) => setPending((p) => p?.kind === "aprobar" ? { ...p, propietarioId: e.target.value } : p)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30">
                  <option value="">— elegí uno —</option>
                  {propietarios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.email ? `· ${p.email}` : p.telefono ? `· ${p.telefono}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Si no existe el propietario, primero creálo desde &quot;Solicitudes de acceso&quot; o &quot;+ Nuevo propietario&quot;.
                </p>
              </div>
            ) : null}

            {pending.row.kind === "verificacion" ? (
              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">UUID de la propiedad a verificar</label>
                <input value={pending.propiedadId}
                  onChange={(e) => setPending((p) => p?.kind === "aprobar" ? { ...p, propiedadId: e.target.value } : p)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"/>
                <p className="mt-1 text-[11px] text-slate-500">
                  La propiedad quedará marcada como <strong>verificada</strong> en la web pública.
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} disabled={!!busyId}
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={aprobar} disabled={!!busyId}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {busyId ? "Aplicando…" : "Aprobar y aplicar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pending?.kind === "rechazar" ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !busyId && setPending(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Rechazar solicitud</h3>
            <p className="mt-1 text-sm text-slate-600">Motivo (opcional) para <strong>{pending.row.nombre}</strong>.</p>
            <textarea value={pending.motivo}
              onChange={(e) => setPending((p) => p?.kind === "rechazar" ? { ...p, motivo: e.target.value } : p)}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30" rows={3}/>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} disabled={!!busyId}
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={!!busyId} onClick={rechazar}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                {busyId ? "Procesando…" : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
