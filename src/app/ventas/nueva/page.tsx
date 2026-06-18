"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MontoInput from "@/components/ui/MontoInput";
import { saveVentaServicio } from "@/lib/ventas/storage";
import type { LineaServicio, MonedaVenta, TipoIvaVenta } from "@/lib/ventas/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMonto(valor: number, moneda: MonedaVenta) {
  const prefix = moneda === "USD" ? "USD" : "Gs.";
  return `${prefix} ${Math.round(valor).toLocaleString("es-PY")}`;
}

function ivaRate(tipo: TipoIvaVenta): number {
  if (tipo === "5%") return 0.05;
  if (tipo === "10%") return 0.10;
  return 0;
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const inputClass =
  "w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:outline-none bg-white text-sm";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex border border-slate-200 rounded-lg overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            value === opt.value
              ? "bg-[#0EA5E9] text-white"
              : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function NuevaVentaPage() {
  const router = useRouter();

  const [razonSocial, setRazonSocial] = useState("");
  const [ruc, setRuc] = useState("");
  const [moneda, setMoneda] = useState<MonedaVenta>("GS");
  const [tipoCambio, setTipoCambio] = useState(1);
  const [tipoIva, setTipoIva] = useState<TipoIvaVenta>("10%");
  const [servicios, setServicios] = useState<LineaServicio[]>([
    { descripcion: "", monto: 0 },
  ]);
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { subtotal, montoIva, total } = useMemo(() => {
    const sub = servicios.reduce((acc, s) => acc + (Number(s.monto) || 0), 0);
    const iva = sub * ivaRate(tipoIva);
    return { subtotal: sub, montoIva: iva, total: sub + iva };
  }, [servicios, tipoIva]);

  function updateServicio(i: number, patch: Partial<LineaServicio>) {
    setServicios((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addServicio() {
    setServicios((arr) => [...arr, { descripcion: "", monto: 0 }]);
  }
  function removeServicio(i: number) {
    setServicios((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!razonSocial.trim()) {
      setErr("Ingresá la razón social del cliente.");
      return;
    }
    const valid = servicios
      .map((s) => ({ descripcion: s.descripcion.trim(), monto: Number(s.monto) || 0 }))
      .filter((s) => s.descripcion && s.monto > 0);
    if (!valid.length) {
      setErr("Cargá al menos una línea de servicio con descripción y monto > 0.");
      return;
    }
    setSaving(true);
    try {
      const res = await saveVentaServicio({
        cliente_razon_social: razonSocial.trim(),
        cliente_ruc: ruc.trim() || null,
        moneda,
        tipo_cambio: moneda === "USD" ? tipoCambio : 1,
        tipo_iva_cabecera: tipoIva,
        servicios: valid,
        subtotal,
        monto_iva: montoIva,
        total,
        observaciones: observaciones.trim() || null,
      });
      if (!res.success) {
        setErr(res.error);
        setSaving(false);
        return;
      }
      router.push("/ventas");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <button
          type="button"
          onClick={() => router.push("/ventas")}
          className="mb-2 inline-flex text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
        >
          ← Volver a ventas
        </button>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nueva venta</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registro al contado. Cargá la razón social, los servicios y el IVA aplicable.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        {err ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle>Condiciones</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Moneda</label>
              <SegmentedControl<MonedaVenta>
                value={moneda}
                onChange={setMoneda}
                options={[
                  { value: "GS", label: "Guaraníes" },
                  { value: "USD", label: "Dólares" },
                ]}
              />
            </div>
            {moneda === "USD" ? (
              <div>
                <label className={labelClass}>Tipo de cambio (Gs. por USD)</label>
                <MontoInput value={tipoCambio} onChange={setTipoCambio} className={inputClass} />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <label className={labelClass}>Tipo de IVA</label>
              <SegmentedControl<TipoIvaVenta>
                value={tipoIva}
                onChange={setTipoIva}
                options={[
                  { value: "EXENTA", label: "Exenta" },
                  { value: "5%", label: "5%" },
                  { value: "10%", label: "10%" },
                ]}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle>Cliente</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Razón social *</label>
              <input
                className={inputClass}
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                placeholder="Ej: Constructora Aurora S.A."
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Nº de RUC</label>
              <input
                className={inputClass}
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                placeholder="Ej: 80012345-6"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-end justify-between gap-3">
            <SectionTitle>Descripción de servicios</SectionTitle>
            <button
              type="button"
              onClick={addServicio}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              + Agregar línea
            </button>
          </div>
          <div className="space-y-3">
            {servicios.map((s, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                <div>
                  <label className={labelClass}>Descripción</label>
                  <input
                    className={inputClass}
                    value={s.descripcion}
                    onChange={(e) => updateServicio(i, { descripcion: e.target.value })}
                    placeholder="Ej: Valor de la casa / Escribanía / Gastos varios"
                  />
                </div>
                <div>
                  <label className={labelClass}>Monto</label>
                  <MontoInput
                    value={s.monto}
                    onChange={(v) => updateServicio(i, { monto: v })}
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeServicio(i)}
                  disabled={servicios.length <= 1}
                  className="h-[38px] rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed sm:self-end"
                  title="Quitar línea"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle>Totales</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Total label="Subtotal" value={subtotal} moneda={moneda} />
            <Total
              label={tipoIva === "EXENTA" ? "IVA (no aplica)" : `IVA ${tipoIva}`}
              value={montoIva}
              moneda={moneda}
              muted={tipoIva === "EXENTA"}
            />
            <Total label="Total" value={total} moneda={moneda} highlight />
          </div>
          <div className="mt-4">
            <label className={labelClass}>Observaciones</label>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas internas (opcional)"
            />
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-xl bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar venta"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/ventas")}
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function Total({
  label,
  value,
  moneda,
  highlight,
  muted,
}: {
  label: string;
  value: number;
  moneda: MonedaVenta;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        highlight
          ? "border-[#4FAEB2] bg-[#ECFEFF]"
          : muted
            ? "border-slate-100 bg-slate-50"
            : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-base font-semibold ${highlight ? "text-[#0EA5E9]" : "text-slate-800"}`}>
        {formatMonto(value, moneda)}
      </div>
    </div>
  );
}
