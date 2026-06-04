"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import ConfirmDialog from "@/components/ConfirmDialog";

type Pack = {
  id: string;
  codigo: string;
  qty: number;
  precio: number;
  moneda: string;
  badge: "popular" | "best" | null;
  orden: number;
  activo: boolean;
};

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1";

function fmtGs(n: number): string { return "Gs. " + Number(n || 0).toLocaleString("es-PY"); }

function PackEditModal({
  pack, onClose, onSaved,
}: {
  pack: Pack | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const empty: Pack = { id: "", codigo: "", qty: 1, precio: 0, moneda: "PYG", badge: null, orden: 0, activo: true };
  const initial = pack === "new" ? empty : pack;
  const [form, setForm] = useState<Pack>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isNew = pack === "new";

  async function save() {
    setErr(null);
    if (!form.codigo.trim()) return setErr("Código requerido");
    if (form.qty <= 0) return setErr("Qty debe ser > 0");
    if (form.precio < 0) return setErr("Precio inválido");
    setBusy(true);
    try {
      const url = isNew ? "/api/dashboard/alquiloya-impulsos-packs" : `/api/dashboard/alquiloya-impulsos-packs/${form.id}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetchWithSupabaseSession(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: form.codigo, qty: form.qty, precio: form.precio, moneda: form.moneda,
          badge: form.badge, orden: form.orden, activo: form.activo,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-base font-semibold text-slate-900">{isNew ? "Nuevo pack" : `Editar ${form.codigo}`}</h3>
        {err ? <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div> : null}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Código *</label>
            <input className={inputCls} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="pack-5"/>
          </div>
          <div>
            <label className={labelCls}>Cantidad *</label>
            <input type="number" min="1" className={inputCls} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) || 0 })}/>
          </div>
          <div>
            <label className={labelCls}>Precio (PYG) *</label>
            <input type="number" min="0" className={inputCls} value={form.precio} onChange={(e) => setForm({ ...form, precio: Number(e.target.value) || 0 })}/>
          </div>
          <div>
            <label className={labelCls}>Orden</label>
            <input type="number" className={inputCls} value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) || 0 })}/>
          </div>
          <div>
            <label className={labelCls}>Badge</label>
            <select className={inputCls} value={form.badge ?? ""} onChange={(e) => setForm({ ...form, badge: (e.target.value || null) as Pack["badge"] })}>
              <option value="">— ninguno —</option>
              <option value="popular">popular (Más elegido)</option>
              <option value="best">best (Mejor precio)</option>
            </select>
          </div>
          <div className="col-span-2 flex items-center">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2]" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })}/>
              Activo (visible en la web)
            </label>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#3F8E91] disabled:opacity-60">
            {busy ? "Guardando…" : isNew ? "Crear" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ImpulsosPacksClient() {
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Pack | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Pack | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  async function load() {
    setErr(null);
    try {
      const res = await fetchWithSupabaseSession("/api/dashboard/alquiloya-impulsos-packs", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; data?: { packs?: Pack[] }; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPacks(data.data?.packs ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }
  useEffect(() => { load(); }, []);

  const ordered = useMemo(() => (packs ?? []).slice().sort((a, b) => a.orden - b.orden || a.qty - b.qty), [packs]);

  async function doDelete() {
    if (!toDelete) return;
    setBusyDel(true);
    try {
      const res = await fetchWithSupabaseSession(`/api/dashboard/alquiloya-impulsos-packs/${toDelete.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setToDelete(null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally { setBusyDel(false); }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#3F8E91]">
          + Nuevo pack
        </button>
      </div>
      {err ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div> : null}
      {packs == null ? (
        <p className="text-sm text-slate-500">Cargando packs…</p>
      ) : ordered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No hay packs cargados. Creá uno con &quot;+ Nuevo pack&quot;.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Código</th>
                <th className="px-3 py-2.5 text-right">Cantidad</th>
                <th className="px-3 py-2.5 text-right">Precio</th>
                <th className="px-3 py-2.5 text-right">Unitario</th>
                <th className="px-3 py-2.5">Badge</th>
                <th className="px-3 py-2.5">Orden</th>
                <th className="px-3 py-2.5">Activo</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{p.codigo}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900 tabular-nums">{p.qty}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{fmtGs(p.precio)}</td>
                  <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{fmtGs(Math.round(p.precio / p.qty))}</td>
                  <td className="px-3 py-2">
                    {p.badge === "popular" ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-300">Más elegido</span>
                    ) : p.badge === "best" ? (
                      <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-sky-300">Mejor precio</span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-700 tabular-nums">{p.orden}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.activo ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-500"}`}>{p.activo ? "Sí" : "No"}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => setEditing(p)} className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200">Editar</button>
                      <button type="button" onClick={() => setToDelete(p)} className="rounded-md bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <PackEditModal pack={editing} onClose={() => setEditing(null)} onSaved={load}/>
      ) : null}

      <ConfirmDialog
        open={!!toDelete}
        title={`Eliminar pack ${toDelete?.codigo ?? ""}`}
        description={<>Esta acción es permanente. Si tenés que pausarlo en lugar de borrarlo, editalo y desmarcá <em>Activo</em>.</>}
        confirmLabel="Eliminar definitivamente"
        tone="danger"
        busy={busyDel}
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
