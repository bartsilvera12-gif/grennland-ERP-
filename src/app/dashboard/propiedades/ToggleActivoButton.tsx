"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export default function ToggleActivoButton({
  id,
  initial,
  titulo,
}: {
  id: string;
  initial: boolean;
  titulo: string | null;
}) {
  const router = useRouter();
  const [activo, setActivo] = useState(!!initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    const next = !activo;
    setBusy(true);
    setErr(null);
    const prev = activo;
    setActivo(next);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-propiedades/${id}/toggle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activo: next }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setActivo(prev);
      const msg = e instanceof Error ? e.message : "Error";
      setErr(msg);
      window.alert(`No se pudo ${next ? "activar" : "desactivar"} "${titulo ?? "esta propiedad"}": ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  const label = activo ? "Sí" : "No";
  const cls = activo
    ? "bg-emerald-100 text-emerald-700 ring-emerald-200 hover:bg-emerald-200"
    : "bg-slate-100 text-slate-600 ring-slate-200 hover:bg-slate-200";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={activo ? "Clic para desactivar" : "Clic para activar"}
      aria-label={activo ? "Desactivar" : "Activar"}
      aria-pressed={activo}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 transition-colors disabled:cursor-wait disabled:opacity-60 ${cls}`}
    >
      {busy ? "…" : label}
      {err ? <span className="sr-only">{err}</span> : null}
    </button>
  );
}
