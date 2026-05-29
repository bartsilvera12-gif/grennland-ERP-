"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth";

type Link = { id: string; slug: string; campania: string | null; cookie_dias: number; activo: boolean };
type Rule = {
  id: string; tipo: string; valor: number; moneda: string | null;
  recurrente: boolean; meses_recurrencia: number | null;
} | null;
type Stats = { clicks: number; conversiones: number; comision_pendiente: number; comision_pagada: number };
type Commission = {
  id: string; periodo: string | null; monto: number; moneda: string;
  estado: string; generada_at: string | null; pagada_at: string | null;
};
type Me = {
  success: true;
  partner: { id: string; nombre: string; email: string | null; telefono: string | null; tipo: string | null; activo: boolean };
  links: Link[];
  rule: Rule;
  stats: Stats;
  commissions: Commission[];
};

function fmt(n: number): string {
  try { return new Intl.NumberFormat("es-PY").format(n); } catch { return String(n); }
}
function fmtGs(n: number): string {
  try {
    return new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(n);
  } catch { return `Gs. ${n.toLocaleString("es-PY")}`; }
}
function fmtRule(r: Rule): string {
  if (!r) return "—";
  const rec = r.recurrente ? ` × ${r.meses_recurrencia ?? "?"}m` : "";
  if (r.tipo === "porcentaje") return `${r.valor}%${rec}`;
  return `${r.moneda ?? "PYG"} ${r.valor.toLocaleString("es-PY")}${rec}`;
}

export default function PortalReferidosDashboardPage() {
  const [data, setData] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/referido/me", { cache: "no-store", credentials: "include" });
        if (r.status === 401) {
          window.location.assign("/portal-referidos/login");
          return;
        }
        if (r.status === 403) {
          await signOut().catch(() => {});
          window.location.assign("/portal-referidos/login?denied=1");
          return;
        }
        if (!r.ok) {
          setError(`HTTP ${r.status}`);
          setLoading(false);
          return;
        }
        const body = (await r.json()) as Me;
        setData(body);
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
        setLoading(false);
      }
    })();
  }, []);

  async function copy(slug: string) {
    const url = `${window.location.origin}/r/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(slug);
      setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1500);
    } catch { /* ignore */ }
  }

  async function doLogout() {
    await signOut().catch(() => {});
    window.location.assign("/portal-referidos/login");
  }

  if (loading) {
    return (
      <main className="min-h-dvh w-full bg-gradient-to-b from-[#EAF4FF] via-white to-white px-4 py-10">
        <div className="mx-auto max-w-3xl text-center text-sm text-slate-500">Cargando…</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-dvh w-full bg-gradient-to-b from-[#EAF4FF] via-white to-white px-4 py-10">
        <div className="mx-auto max-w-md text-center">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error || "No se pudo cargar tu información."}
          </div>
          <div className="mt-4">
            <Link href="/portal-referidos/login" className="text-sm text-[#0058A5] hover:underline">
              Volver a ingresar
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const primary = data.links.find((l) => l.activo) ?? data.links[0] ?? null;

  return (
    <main className="min-h-dvh w-full bg-gradient-to-b from-[#EAF4FF] via-white to-white px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/alquiloya-legacy/assets/logo.png" alt="AlquiloYa" className="h-8 w-auto" />
            <div className="text-sm font-semibold text-slate-800">Portal de referidos</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{data.partner.nombre}</span>
            <button
              type="button"
              onClick={doLogout}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Salir
            </button>
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">¡Hola, {data.partner.nombre}!</h1>
          <p className="mt-1 text-sm text-slate-500">
            Esta es tu vista de referidos. Tu comisión configurada es <strong>{fmtRule(data.rule)}</strong>.
          </p>
        </section>

        {/* Link único */}
        <section className="mb-6 rounded-2xl border border-[#0058A5]/20 bg-gradient-to-br from-[#EAF4FF] to-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0058A5]">Tu link único</div>
          {primary ? (
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-[#0058A5]">
                {typeof window !== "undefined" ? `${window.location.origin}/r/${primary.slug}` : `/r/${primary.slug}`}
              </div>
              <button
                type="button"
                onClick={() => copy(primary.slug)}
                className="inline-flex items-center justify-center rounded-full bg-[#0058A5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004B8F]"
              >
                {copied === primary.slug ? "¡Copiado!" : "Copiar link"}
              </button>
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-500">Todavía no tenés un link configurado. Contactá al equipo.</div>
          )}
        </section>

        {/* Stats */}
        <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Clicks" value={fmt(data.stats.clicks)} />
          <StatCard label="Conversiones" value={fmt(data.stats.conversiones)} />
          <StatCard label="Comisión pendiente" value={fmtGs(data.stats.comision_pendiente)} />
          <StatCard label="Comisión pagada" value={fmtGs(data.stats.comision_pagada)} />
        </section>

        {/* Comisiones */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Tus comisiones</h2>
          </div>
          {data.commissions.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              Todavía no hay conversiones ni comisiones registradas. Cuando alguien se suscriba
              usando tu link, vas a verlo acá.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Período</th>
                    <th className="px-4 py-2.5 text-right">Monto</th>
                    <th className="px-4 py-2.5">Estado</th>
                    <th className="px-4 py-2.5">Generada</th>
                    <th className="px-4 py-2.5">Pagada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-[12px] text-slate-700">{c.periodo ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtGs(c.monto)}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                            c.estado === "pagada"
                              ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                              : c.estado === "pendiente"
                              ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                          }`}
                        >
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">{c.generada_at?.slice(0, 10) ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{c.pagada_at?.slice(0, 10) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
    </div>
  );
}
