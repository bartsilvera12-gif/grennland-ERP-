"use client";

import Link from "next/link";
import type { ActividadItem } from "./GerencialOverview";

function relativo(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days < 7) return `hace ${days} d`;
  try {
    return new Intl.DateTimeFormat("es-PY", { day: "numeric", month: "short" }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

const TIPO_TONO: Record<string, string> = {
  Propiedad: "bg-[#4FAEB2]/10 text-[#3F8E91] ring-[#4FAEB2]/30",
  Solicitud: "bg-amber-100 text-amber-700 ring-amber-200",
  Reseña: "bg-violet-100 text-violet-700 ring-violet-200",
  Consulta: "bg-blue-100 text-blue-700 ring-blue-200",
};

export default function ActividadReciente({ items }: { items: ActividadItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Actividad reciente" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">Actividad reciente</h3>
        <span className="text-[11px] text-slate-400">{items.length} eventos</span>
      </header>
      <ul className="divide-y divide-slate-100">
        {items.map((it) => {
          const tone = TIPO_TONO[it.tipo] ?? "bg-slate-100 text-slate-600 ring-slate-200";
          const content = (
            <li className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50">
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${tone}`}
              >
                {it.tipo}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">{it.titulo}</div>
                {it.detalle ? (
                  <div className="truncate text-[11px] text-slate-500">{it.detalle}</div>
                ) : null}
              </div>
              <div className="shrink-0 text-[11px] text-slate-400">{relativo(it.cuando)}</div>
            </li>
          );
          return it.href ? (
            <Link key={it.key} href={it.href} className="block">
              {content}
            </Link>
          ) : (
            <div key={it.key}>{content}</div>
          );
        })}
      </ul>
    </section>
  );
}
