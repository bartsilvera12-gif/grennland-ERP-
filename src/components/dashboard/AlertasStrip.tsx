"use client";

import Link from "next/link";
import type { Alerta } from "./GerencialOverview";

// Paleta unificada teal — a pedido del cliente, todas las cards del
// dashboard usan el mismo color que "Propiedades" para mantener un tema
// visual consistente. La severidad (danger/warning/info) se conserva en
// los datos por si en el futuro queremos diferenciar por icono o badge.
const TEAL_TONE = {
  bg: "bg-teal-50",
  ring: "ring-teal-200",
  text: "text-teal-700",
  textSoft: "text-teal-600/80",
  numText: "text-teal-900",
  hover: "hover:bg-teal-100",
};
const TONO: Record<Alerta["severity"], typeof TEAL_TONE> = {
  danger: TEAL_TONE,
  warning: TEAL_TONE,
  info: TEAL_TONE,
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
