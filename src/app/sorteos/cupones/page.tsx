"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSorteoCupones } from "@/lib/sorteos/actions";
import type { SorteoCupon } from "@/lib/sorteos/types";

export default function SorteoCuponesPage() {
  const [rows, setRows] = useState<SorteoCupon[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getSorteoCupones()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Cupones</h1>
        <p className="text-gray-500 text-sm mt-1">Números por boleto</p>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm border-b border-slate-200 pb-3">
        <Link href="/sorteos" className="text-slate-600 hover:text-[#0EA5E9]">
          Sorteos
        </Link>
        <Link href="/sorteos/conversaciones" className="text-slate-600 hover:text-[#0EA5E9]">
          Conversaciones
        </Link>
        <Link href="/sorteos/entradas" className="text-slate-600 hover:text-[#0EA5E9]">
          Entradas
        </Link>
        <span className="font-semibold text-[#0EA5E9]">Cupones</span>
      </nav>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {cargando ? (
          <div className="py-16 text-center text-gray-400 text-sm animate-pulse">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No hay cupones</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Sorteo</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Participante</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Nº cupón</th>
                  <th className="text-left text-sm font-semibold text-slate-600 px-5 py-3">Ganador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 text-sm text-slate-800">
                      {(r.sorteos as { nombre?: string } | undefined)?.nombre ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      {(r.sorteo_entradas as { nombre_participante?: string } | undefined)?.nombre_participante ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono font-semibold">{r.numero_cupon}</td>
                    <td className="px-5 py-3 text-sm">{r.ganador ? "Sí" : "No"}</td>
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
