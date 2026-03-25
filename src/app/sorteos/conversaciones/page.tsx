"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSorteoConversaciones } from "@/lib/sorteos/actions";
import type { SorteoConversacion } from "@/lib/sorteos/types";

function formatFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SorteoConversacionesPage() {
  const [rows, setRows] = useState<SorteoConversacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getSorteoConversaciones()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Conversaciones</h1>
        <p className="text-gray-500 text-sm mt-1">WhatsApp / flujo de sorteos</p>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm border-b border-slate-200 pb-3">
        <Link href="/sorteos" className="text-slate-600 hover:text-[#0EA5E9]">
          Sorteos
        </Link>
        <span className="font-semibold text-[#0EA5E9]">Conversaciones</span>
        <Link href="/sorteos/entradas" className="text-slate-600 hover:text-[#0EA5E9]">
          Entradas
        </Link>
        <Link href="/sorteos/cupones" className="text-slate-600 hover:text-[#0EA5E9]">
          Cupones
        </Link>
      </nav>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {cargando ? (
          <div className="py-16 text-center text-gray-400 text-sm animate-pulse">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No hay conversaciones</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Sorteo</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">WhatsApp</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Estado</th>
                  <th className="text-right text-sm font-semibold text-slate-600 px-5 py-3">Boletos</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Último mensaje</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 text-sm text-slate-800">
                      {(r.sorteos as { nombre?: string } | undefined)?.nombre ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-slate-700">{r.whatsapp_numero}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{r.estado}</td>
                    <td className="px-5 py-3 text-sm text-right tabular-nums">{r.cantidad_boletos ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-slate-600 max-w-[220px] truncate" title={r.ultimo_mensaje ?? ""}>
                      {r.ultimo_mensaje ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 whitespace-nowrap">{formatFecha(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
