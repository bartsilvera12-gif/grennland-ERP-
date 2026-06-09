"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Gráfico de "Cobrado por día" del dashboard Financiero.
 *
 * PERF: recharts pesa ~400KB y antes se importaba estático en page.tsx, así
 * que entraba en el bundle inicial del dashboard (la landing del ERP) aunque
 * el gráfico solo se ve en la pestaña Financiero. Extraído acá para cargarlo
 * con next/dynamic(ssr:false) — recharts se descarga recién cuando se renderiza
 * esta pestaña.
 *
 * Los formatters son los mismos de page.tsx, inlineados para que el componente
 * sea self-contained (son funciones puras triviales).
 */

type Punto = { fecha: string; monto: number; count: number };

function formatGs(n: number): string {
  return n.toLocaleString("es-PY");
}

/** Formato abreviado para los ejes (K / M / B). */
function formatGsM(n: number): string {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return "0";
  if (num >= 1_000_000_000) {
    const b = num / 1_000_000_000;
    return b % 1 === 0 ? `${b}B` : `${b.toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (num >= 1_000) return `${Math.round(num / 1_000)}K`;
  return num.toLocaleString("es-PY");
}

function formatFecha(s: string): string {
  const cal = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(cal)) {
    const [y, m, d] = cal.split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function CobradoLineChart({
  data,
  accent,
}: {
  data: Punto[];
  accent: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="fecha"
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#cbd5e1" }}
          tickFormatter={(ymd: string) => {
            if (!ymd || ymd.length < 10) return ymd;
            return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
          }}
          minTickGap={28}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#cbd5e1" }}
          tickFormatter={(v: number) => formatGsM(Number(v))}
          width={52}
        />
        <Tooltip
          cursor={{ stroke: "rgba(79,174,178,0.25)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as Punto;
            return (
              <div className="rounded-lg border border-[#4FAEB2]/45 bg-white px-3 py-2 text-xs text-slate-800 shadow-lg">
                <p className="font-medium text-slate-500">{formatFecha(row.fecha)}</p>
                <p className="mt-1.5 text-sm font-semibold tabular-nums text-slate-900">
                  Gs. {formatGs(row.monto)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {row.count} pago{row.count === 1 ? "" : "s"}
                </p>
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="monto"
          stroke={accent}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: accent, stroke: "#fff", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
