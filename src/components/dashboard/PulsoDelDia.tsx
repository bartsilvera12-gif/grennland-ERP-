"use client";

import Link from "next/link";
import type { Kpi } from "./GerencialOverview";

function Delta({ d }: { d: NonNullable<Kpi["delta"]> }) {
  const cls =
    d.sign === "up"
      ? "text-emerald-600"
      : d.sign === "down"
        ? "text-rose-600"
        : "text-slate-400";
  const arrow = d.sign === "up" ? "↑" : d.sign === "down" ? "↓" : "—";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${cls}`}>
      {arrow} {d.value} <span className="font-normal text-slate-400">{d.suffix}</span>
    </span>
  );
}

export default function PulsoDelDia({ kpis }: { kpis: Kpi[] }) {
  return (
    <section aria-label="Pulso del día">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Pulso del día
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const card = (
            <div className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-[#4FAEB2]/50">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {k.label}
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{k.value}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                {k.sub ? <span>{k.sub}</span> : null}
                {k.delta ? <Delta d={k.delta} /> : null}
              </div>
            </div>
          );
          return k.href ? (
            <Link key={k.key} href={k.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={k.key}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}
