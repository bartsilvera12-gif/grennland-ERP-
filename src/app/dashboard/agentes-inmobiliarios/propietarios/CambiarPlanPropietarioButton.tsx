"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

type PlanRow = {
  id: string;
  tier: string | null;
  nombre: string | null;
  billing: string | null;
};

export default function CambiarPlanPropietarioButton({
  id,
  nombre,
  currentPlanId,
  currentVencimiento,
}: {
  id: string;
  nombre: string;
  currentPlanId: string | null;
  currentVencimiento: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [planes, setPlanes] = useState<PlanRow[] | null>(null);
  const [planId, setPlanId] = useState<string>(currentPlanId ?? "");
  const initialFecha = (() => {
    if (currentVencimiento) {
      try {
        return new Date(currentVencimiento).toISOString().slice(0, 10);
      } catch {
        /* ignore */
      }
    }
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();
  const [vencimiento, setVencimiento] = useState<string>(initialFecha);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (planes !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchWithSupabaseSession("/api/dashboard/alquiloya-planes-publicacion");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const body = (await r.json()) as {
          data?: { planes?: PlanRow[] };
          planes?: PlanRow[];
        };
        if (cancelled) return;
        const list = body?.data?.planes ?? body?.planes ?? [];
        setPlanes(list);
      } catch (e) {
        if (cancelled) return;
        setPlanes([]);
        setErr(e instanceof Error ? e.message : "No pudimos cargar los planes");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, planes]);

  async function guardar() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        plan_publicacion_id: planId || null,
        plan_vencimiento_at:
          planId && vencimiento ? new Date(vencimiento + "T00:00:00").toISOString() : null,
      };
      const r = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-propietarios/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error ?? "HTTP " + r.status);
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
        title="Cambiar plan"
      >
        Plan
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="mt-16 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900">Cambiar plan</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Propietario: <strong className="text-slate-700">{nombre}</strong>
              </p>
            </div>

            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Plan
            </label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              disabled={planes === null}
              className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
            >
              <option value="">Sin plan</option>
              {(planes ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre ?? p.tier ?? p.id}
                  {p.billing ? ` · ${p.billing}` : ""}
                </option>
              ))}
            </select>

            {planId ? (
              <>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Vencimiento
                </label>
                <input
                  type="date"
                  value={vencimiento}
                  onChange={(e) => setVencimiento(e.target.value)}
                  className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
                />
                <p className="mb-4 text-[11px] text-slate-500">
                  Si el plan es gratuito, igual se guarda la fecha pero no la usa nadie.
                </p>
              </>
            ) : null}

            {err ? (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                {err}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy || planes === null}
                onClick={guardar}
                className="rounded-lg bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#3F8E91] disabled:opacity-60"
              >
                {busy ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
