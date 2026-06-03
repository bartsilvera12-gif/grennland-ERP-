"use client";

import Link from "next/link";
import type { Alerta } from "./GerencialOverview";

const TONO: Record<Alerta["severity"], { bg: string; ring: string; text: string; textSoft: string; numText: string; hover: string }> = {
  danger: {
    bg: "bg-rose-50",
    ring: "ring-rose-200",
    text: "text-rose-700",
    textSoft: "text-rose-600/80",
    numText: "text-rose-900",
    hover: "hover:bg-rose-100",
  },
  warning: {
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    text: "text-amber-700",
    textSoft: "text-amber-600/80",
    numText: "text-amber-900",
    hover: "hover:bg-amber-100",
  },
  info: {
    bg: "bg-blue-50",
    ring: "ring-blue-200",
    text: "text-blue-700",
    textSoft: "text-blue-600/80",
    numText: "text-blue-900",
    hover: "hover:bg-blue-100",
  },
};

export default function AlertasStrip({ alertas }: { alertas: Alerta[] }) {
  return (
    <section aria-label="Alertas">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Atención requerida
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {alertas.map((a) => {
          const t = TONO[a.severity];
          return (
            <Link
              key={a.key}
              href={a.href}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 ring-1 transition-colors ${t.bg} ${t.ring} ${t.hover}`}
            >
              <div className="min-w-0">
                <div className={`text-[10px] font-semibold uppercase tracking-wider ${t.text}`}>
                  {a.label}
                </div>
                <div className={`text-[10px] font-medium ${t.textSoft}`}>ver y resolver →</div>
              </div>
              <div className={`text-2xl font-bold tabular-nums ${t.numText}`}>{a.count}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
