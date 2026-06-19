"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getVentas } from "@/lib/ventas/storage";
import type { Venta, TipoIvaVenta } from "@/lib/ventas/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMoneda(valor: number, moneda: "GS" | "USD") {
  const prefix = moneda === "USD" ? "USD" : "Gs.";
  return `${prefix} ${Math.round(valor).toLocaleString("es-PY")}`;
}

function formatFecha(iso: string) {
  try {
    const d    = new Date(iso);
    const dd   = String(d.getDate()).padStart(2, "0");
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh   = String(d.getHours()).padStart(2, "0");
    const min  = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return iso;
  }
}

const inputFilterClass =
  "border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#4FAEB2]/40 focus:border-[#4FAEB2] focus:outline-none";

const ivaLabel: Record<TipoIvaVenta, string> = {
  EXENTA: "Exenta",
  "5%":   "IVA 5%",
  "10%":  "IVA 10%",
};

const ivaBadge: Record<TipoIvaVenta, string> = {
  EXENTA: "bg-slate-100 text-slate-600",
  "5%":   "bg-amber-50 text-amber-700",
  "10%":  "bg-indigo-50 text-indigo-700",
};

// ── Métricas del día ──────────────────────────────────────────────────────────

function esDeHoy(iso: string): boolean {
  try {
    const fecha = new Date(iso);
    const hoy   = new Date();
    return (
      fecha.getFullYear() === hoy.getFullYear() &&
      fecha.getMonth()    === hoy.getMonth()    &&
      fecha.getDate()     === hoy.getDate()
    );
  } catch {
    return false;
  }
}

interface MetricasHoy {
  facturacion:    number;
  cantidadVentas: number;
  ticketPromedio: number;
}

function calcularMetricas(ventas: Venta[]): MetricasHoy {
  const deHoy            = ventas.filter((v) => esDeHoy(v.fecha));
  const facturacion      = deHoy.reduce((s, v) => s + v.total, 0);
  const cantidadVentas   = deHoy.length;
  const ticketPromedio   = cantidadVentas > 0 ? facturacion / cantidadVentas : 0;
  return { facturacion, cantidadVentas, ticketPromedio };
}

// ── Tarjeta métrica ───────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, accent,
}: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border px-5 py-4 flex flex-col gap-1 shadow-sm transition-shadow hover:shadow-md ${
        accent
          ? "border-[#4FAEB2]/30 bg-gradient-to-br from-[#4FAEB2]/10 via-white to-white ring-1 ring-[#4FAEB2]/20"
          : "border-slate-200 bg-white"
      }`}
    >
      {accent ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#4FAEB2] via-[#4FAEB2]/70 to-[#4FAEB2]/30"
        />
      ) : null}
      <span
        className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
          accent ? "text-[#3F8E91]" : "text-slate-500"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-2xl font-bold tabular-nums leading-tight ${
          accent ? "text-slate-900" : "text-slate-800"
        }`}
      >
        {value}
      </span>
      {sub && <span className={`text-xs ${accent ? "text-slate-500" : "text-gray-400"}`}>{sub}</span>}
    </div>
  );
}

// ── Helpers de fila ───────────────────────────────────────────────────────────

/** Identificacion del cliente / contenido de la venta. */
function ResumenCliente({ v }: { v: Venta }) {
  if (v.cliente_razon_social) {
    const primera = v.servicios?.[0]?.descripcion;
    const extra = (v.servicios?.length ?? 0) - 1;
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-gray-800 leading-tight">{v.cliente_razon_social}</span>
        <div className="flex items-center gap-2 mt-0.5">
          {v.cliente_ruc ? (
            <span className="font-mono text-xs text-gray-400">RUC {v.cliente_ruc}</span>
          ) : null}
          {primera ? (
            <span className="text-xs text-gray-500 truncate max-w-[260px]">{primera}</span>
          ) : null}
          {extra > 0 ? (
            <span className="bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full font-medium">
              +{extra} más
            </span>
          ) : null}
        </div>
      </div>
    );
  }
  // Modo viejo (productos): mostramos el primer item como antes.
  const primero = v.items[0];
  if (!primero) return <span className="text-xs text-gray-400">Sin líneas cargadas</span>;
  const extra = v.items.length - 1;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-gray-800 leading-tight">{primero.producto_nombre}</span>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="font-mono text-xs text-gray-400">{primero.sku}</span>
        {extra > 0 && (
          <span className="bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full font-medium">
            +{extra} más
          </span>
        )}
      </div>
    </div>
  );
}

/** Determina qué IVA mostrar: cabecera nueva, o resumen de items (modo viejo). */
function ivaDeVenta(v: Venta): TipoIvaVenta | "Mixto" {
  if (v.tipo_iva_cabecera) return v.tipo_iva_cabecera;
  const tipos = [...new Set(v.items.map((i) => i.tipo_iva))];
  if (tipos.length === 1) return tipos[0];
  return "Mixto";
}

// ── Filtros utilitarios ───────────────────────────────────────────────────────

function ymdToDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function VentasPage() {
  const [todas, setTodas] = useState<Venta[]>([]);

  const [busqueda,      setBusqueda]      = useState("");
  const [fechaDesde,    setFechaDesde]    = useState(""); // YYYY-MM-DD
  const [fechaHasta,    setFechaHasta]    = useState("");
  const [mes,           setMes]           = useState(""); // YYYY-MM
  const [montoDesde,    setMontoDesde]    = useState("");
  const [montoHasta,    setMontoHasta]    = useState("");
  const [filtroIva,     setFiltroIva]     = useState<TipoIvaVenta | "">("");

  useEffect(() => {
    let cancelled = false;
    getVentas().then((data) => {
      if (cancelled) return;
      const ordenadas = [...data].sort((a, b) => {
        const ta = new Date(a.fecha).getTime();
        const tb = new Date(b.fecha).getTime();
        return tb - ta || b.numero_control.localeCompare(a.numero_control);
      });
      setTodas(ordenadas);
    });
    return () => { cancelled = true; };
  }, []);

  const metricas = calcularMetricas(todas);

  const filtradas = useMemo(() => todas.filter((v) => {
    if (busqueda.trim() !== "") {
      const t = busqueda.toLowerCase().trim();
      const haystack = [
        v.numero_control,
        v.cliente_razon_social ?? "",
        v.cliente_ruc ?? "",
        ...(v.servicios ?? []).map((s) => s.descripcion),
        ...v.items.map((i) => `${i.producto_nombre} ${i.sku}`),
      ].join(" ").toLowerCase();
      if (!haystack.includes(t)) return false;
    }
    const fechaVenta = new Date(v.fecha);
    if (Number.isNaN(fechaVenta.getTime())) return false;
    const desde = ymdToDate(fechaDesde);
    if (desde && fechaVenta < desde) return false;
    const hasta = ymdToDate(fechaHasta);
    if (hasta) {
      const fin = new Date(hasta);
      fin.setHours(23, 59, 59, 999);
      if (fechaVenta > fin) return false;
    }
    if (mes) {
      // mes es YYYY-MM
      const [yy, mm] = mes.split("-");
      const yi = Number(yy), mi = Number(mm) - 1;
      if (!(fechaVenta.getFullYear() === yi && fechaVenta.getMonth() === mi)) return false;
    }
    const md = Number(montoDesde);
    if (montoDesde !== "" && Number.isFinite(md) && v.total < md) return false;
    const mh = Number(montoHasta);
    if (montoHasta !== "" && Number.isFinite(mh) && v.total > mh) return false;
    if (filtroIva !== "") {
      const iva = ivaDeVenta(v);
      if (iva !== filtroIva) return false;
    }
    return true;
  }), [todas, busqueda, fechaDesde, fechaHasta, mes, montoDesde, montoHasta, filtroIva]);

  const hayFiltros =
    busqueda || fechaDesde || fechaHasta || mes || montoDesde || montoHasta || filtroIva;

  function limpiarFiltros() {
    setBusqueda("");
    setFechaDesde("");
    setFechaHasta("");
    setMes("");
    setMontoDesde("");
    setMontoHasta("");
    setFiltroIva("");
  }

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold text-gray-800">Ventas</h1>
        <p className="text-gray-600">Registro de ventas al contado por servicios</p>
      </div>

      {/* ── Métricas del día ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">
          Resumen de hoy —{" "}
          {new Date().toLocaleDateString("es-PY", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard
            label="Facturación de hoy"
            value={`Gs. ${metricas.facturacion.toLocaleString("es-PY")}`}
            sub="Total incl. IVA"
            accent
          />
          <MetricCard
            label="Ventas de hoy"
            value={String(metricas.cantidadVentas)}
            sub={metricas.cantidadVentas === 1 ? "orden registrada" : "órdenes registradas"}
          />
          <MetricCard
            label="Ticket promedio"
            value={
              metricas.ticketPromedio > 0
                ? `Gs. ${Math.round(metricas.ticketPromedio).toLocaleString("es-PY")}`
                : "—"
            }
            sub="Por orden de venta"
          />
        </div>
      </div>

      {/* ── Tabla de ventas ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">

        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-semibold">Órdenes de venta</h2>
          <Link
            href="/ventas/nueva"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/40"
          >
            + Nueva venta
          </Link>
        </div>

        {/* Filtros */}
        <div className="mb-5 pb-5 border-b border-gray-100 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Buscar por número, razón social, RUC o concepto…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={`${inputFilterClass} min-w-72 flex-1`}
            />
            <select
              value={filtroIva}
              onChange={(e) => setFiltroIva(e.target.value as TipoIvaVenta | "")}
              className={inputFilterClass}
            >
              <option value="">Todos los tipos (IVA)</option>
              <option value="EXENTA">Exenta</option>
              <option value="5%">IVA 5%</option>
              <option value="10%">IVA 10%</option>
            </select>
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors px-2"
              >
                Limpiar filtros
              </button>
            )}
            <span className="ml-auto text-sm text-gray-400">
              {filtradas.length} de {todas.length} ventas
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <FieldFiltro label="Desde">
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className={inputFilterClass} />
            </FieldFiltro>
            <FieldFiltro label="Hasta">
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className={inputFilterClass} />
            </FieldFiltro>
            <FieldFiltro label="Mes">
              <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={inputFilterClass} />
            </FieldFiltro>
            <FieldFiltro label="Monto mínimo (Gs.)">
              <input
                type="number"
                inputMode="numeric"
                value={montoDesde}
                onChange={(e) => setMontoDesde(e.target.value)}
                className={`${inputFilterClass} w-36`}
                placeholder="0"
                min={0}
              />
            </FieldFiltro>
            <FieldFiltro label="Monto máximo (Gs.)">
              <input
                type="number"
                inputMode="numeric"
                value={montoHasta}
                onChange={(e) => setMontoHasta(e.target.value)}
                className={`${inputFilterClass} w-36`}
                placeholder="—"
                min={0}
              />
            </FieldFiltro>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm font-semibold">
                <th className="py-3 pr-4 font-medium">Número</th>
                <th className="py-3 pr-4 font-medium">Cliente / Concepto</th>
                <th className="py-3 pr-4 font-medium">IVA</th>
                <th className="py-3 pr-4 font-medium text-right">Subtotal</th>
                <th className="py-3 pr-4 font-medium text-right">Total</th>
                <th className="py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    {todas.length === 0
                      ? "No hay ventas registradas"
                      : "Ninguna venta coincide con los filtros"}
                  </td>
                </tr>
              ) : (
                filtradas.map((v) => {
                  const iva = ivaDeVenta(v);
                  return (
                    <tr key={v.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="py-4 pr-4 font-mono text-xs align-middle">
                        {v.factura_id ? (
                          <Link href={`/facturas/${v.factura_id}`} className="text-[#0EA5E9] hover:underline">
                            {v.numero_control}
                          </Link>
                        ) : (
                          <span className="text-gray-500">{v.numero_control}</span>
                        )}
                      </td>
                      <td className="py-4 pr-4 align-middle">
                        <ResumenCliente v={v} />
                      </td>
                      <td className="py-4 pr-4 align-middle">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            iva === "Mixto" ? "bg-slate-100 text-slate-600" : ivaBadge[iva]
                          }`}
                        >
                          {iva === "Mixto" ? "Mixto" : ivaLabel[iva]}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-right tabular-nums text-gray-700 align-middle">
                        {formatMoneda(v.subtotal, v.moneda)}
                      </td>
                      <td className="py-4 pr-4 text-right tabular-nums font-semibold text-gray-800 align-middle">
                        {formatMoneda(v.total, v.moneda)}
                      </td>
                      <td className="py-4 text-gray-500 text-xs tabular-nums align-middle">
                        {formatFecha(v.fecha)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}

function FieldFiltro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {label}
      {children}
    </label>
  );
}
