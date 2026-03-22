"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMarketingTasksDelMes,
  getMetricasCumplimiento,
  getTodasMarketingTasks,
  type MetricasCumplimiento,
} from "@/lib/marketing/storage";
import { getClientes, clienteNombre } from "@/lib/clientes/storage";
import { getUsuariosActivosEmpresa } from "@/lib/usuarios/empresa";
import type { MarketingTask } from "@/lib/marketing/types";

function formatFecha(str: string) {
  if (!str) return "—";
  try {
    const [y, m, d] = str.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return str;
  }
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const ESTADO_CLS: Record<string, string> = {
  pendiente: "bg-gray-100 text-gray-700",
  en_proceso: "bg-blue-100 text-blue-700",
  en_revision: "bg-amber-100 text-amber-700",
  aprobado: "bg-green-100 text-green-700",
  publicado: "bg-emerald-100 text-emerald-700",
};

function TaskRow({
  tarea,
  clienteNombre: nombre,
  usuarioNombre,
  origen,
}: {
  tarea: MarketingTask;
  clienteNombre: string;
  usuarioNombre: string;
  origen: string;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const atrasada = tarea.fecha_entrega < hoy && !["publicado", "aprobado"].includes(tarea.estado);

  return (
    <tr className={`hover:bg-slate-50 ${atrasada ? "bg-red-50/50" : ""}`}>
      <td className="px-4 py-3 font-medium text-slate-800">
        {tarea.titulo}
        {atrasada && <span className="ml-1.5 text-xs text-red-600 font-medium">(atrasada)</span>}
      </td>
      <td className="px-4 py-3 text-slate-600 capitalize">{tarea.tipo_contenido}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_CLS[tarea.estado] ?? "bg-gray-100"}`}>
          {tarea.estado.replace("_", " ")}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">{formatFecha(tarea.fecha_entrega)}</td>
      <td className="px-4 py-3 text-slate-600">{nombre}</td>
      <td className="px-4 py-3 text-slate-600">{usuarioNombre || "—"}</td>
      <td className="px-4 py-3 text-xs text-slate-500">{origen}</td>
      <td className="px-4 py-3">
        <Link href={`/clientes/${tarea.cliente_id}`} className="text-xs text-[#0EA5E9] hover:underline">
          Ver cliente
        </Link>
      </td>
    </tr>
  );
}

export default function MarketingOpsPage() {
  const hoy = new Date().toISOString().slice(0, 10);
  const mesActual = new Date().toISOString().slice(0, 7);

  const [mes, setMes] = useState(mesActual);
  const [tareas, setTareas] = useState<MarketingTask[]>([]);
  const [clientes, setClientes] = useState<Awaited<ReturnType<typeof getClientes>>>([]);
  const [usuarios, setUsuarios] = useState<Awaited<ReturnType<typeof getUsuariosActivosEmpresa>>>([]);
  const [metricas, setMetricas] = useState<MetricasCumplimiento>({ total: 0, completadas: 0, porcentaje: 0 });
  const [cargando, setCargando] = useState(true);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroResponsable, setFiltroResponsable] = useState("");

  const [syncPreview, setSyncPreview] = useState<{
    clientes_a_marcar_count: number;
    tareas_a_generar_count: number;
    clientes_a_marcar: { id: string; nombre: string }[];
    tareas_a_generar: { cliente_nombre: string; fecha_entrega: string; tipo_contenido: string }[];
  } | null>(null);
  const [syncEjecutando, setSyncEjecutando] = useState(false);
  const [syncMostrarPreview, setSyncMostrarPreview] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    Promise.all([
      getMarketingTasksDelMes(mes),
      getTodasMarketingTasks(),
      getClientes(),
      getUsuariosActivosEmpresa(),
      getMetricasCumplimiento(mes),
    ])
      .then(([tMes, tAll, c, u, met]) => {
        setTareas(tMes);
        setClientes(c);
        setUsuarios(u);
        setMetricas(met);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const clientesMarketing = useMemo(
    () => clientes.filter((c) => c.tipo_servicio_cliente === "marketing" && c.estado === "activo"),
    [clientes]
  );

  const clienteMap = useMemo(() => {
    const m = new Map<string, string>();
    clientes.forEach((c) => m.set(c.id, clienteNombre(c)));
    return m;
  }, [clientes]);

  const usuarioMap = useMemo(() => {
    const m = new Map<string, string>();
    usuarios.forEach((u) => m.set(u.id, u.nombre ?? u.email));
    return m;
  }, [usuarios]);

  const { atrasadas, hoy: tareasHoy, semana } = useMemo(() => {
    const hoyDate = new Date();
    const hoyStr = hoyDate.toISOString().slice(0, 10);
    const finSemana = new Date(hoyDate);
    finSemana.setDate(finSemana.getDate() + 6);
    const finSemanaStr = finSemana.toISOString().slice(0, 10);

    const atrasadasList: MarketingTask[] = [];
    const hoyList: MarketingTask[] = [];
    const semanaList: MarketingTask[] = [];

    for (const t of tareas) {
      if (t.fecha_entrega < hoyStr && !["publicado", "aprobado"].includes(t.estado)) {
        atrasadasList.push(t);
      } else if (t.fecha_entrega === hoyStr) {
        hoyList.push(t);
      } else if (t.fecha_entrega > hoyStr && t.fecha_entrega <= finSemanaStr) {
        semanaList.push(t);
      }
    }
    return { atrasadas: atrasadasList, hoy: hoyList, semana: semanaList };
  }, [tareas]);

  const tareasFiltradas = useMemo(() => {
    let r = tareas;
    if (filtroCliente) {
      r = r.filter((t) => clienteMap.get(t.cliente_id)?.toLowerCase().includes(filtroCliente.toLowerCase()));
    }
    if (filtroResponsable) {
      r = r.filter((t) => {
        const nom = t.responsable_user_id ? usuarioMap.get(t.responsable_user_id) : "";
        return nom?.toLowerCase().includes(filtroResponsable.toLowerCase());
      });
    }
    return r;
  }, [tareas, filtroCliente, filtroResponsable, clienteMap, usuarioMap]);

  const grupoPorDia = useMemo(() => {
    const map = new Map<string, MarketingTask[]>();
    for (const t of tareasFiltradas) {
      const list = map.get(t.fecha_entrega) ?? [];
      list.push(t);
      map.set(t.fecha_entrega, list);
    }
    return map;
  }, [tareasFiltradas]);

  const diasDelMes = useMemo(() => {
    const [ano, mesNum] = mes.split("-").map(Number);
    const ultimo = new Date(ano, mesNum, 0).getDate();
    const dias: string[] = [];
    for (let d = 1; d <= ultimo; d++) {
      dias.push(`${mes}-${String(d).padStart(2, "0")}`);
    }
    return dias;
  }, [mes]);

  async function handlePreviewSync() {
    try {
      const res = await fetch(`/api/marketing/sync?preview=1&mes=${mes}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setSyncPreview({
          clientes_a_marcar_count: json.data.resumen?.clientes_a_marcar_count ?? 0,
          tareas_a_generar_count: json.data.resumen?.tareas_a_generar_count ?? 0,
          clientes_a_marcar: json.data.clientes_a_marcar ?? [],
          tareas_a_generar: (json.data.tareas_a_generar ?? []).slice(0, 20),
        });
        setSyncMostrarPreview(true);
      }
    } catch {
      setSyncPreview(null);
    }
  }

  async function handleExecuteSync() {
    setSyncEjecutando(true);
    try {
      const res = await fetch("/api/marketing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, confirmar: true }),
      });
      const json = await res.json();
      if (res.ok) {
        setSyncMostrarPreview(false);
        setSyncPreview(null);
        cargar();
      } else {
        alert(json.error ?? "Error al sincronizar");
      }
    } catch {
      alert("Error al sincronizar");
    } finally {
      setSyncEjecutando(false);
    }
  }

  const [ano, mesNum] = mes.split("-").map(Number);

  if (cargando && tareas.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Marketing Ops</h1>
        <div className="py-16 text-center text-gray-400 text-sm animate-pulse">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Marketing Ops</h1>
          <p className="text-gray-500 text-sm mt-1">Tareas de contenido basadas en planes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePreviewSync}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            Sincronizar (preview)
          </button>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2"
          >
            {Array.from({ length: 24 }, (_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - 6 + i);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const val = `${y}-${m}`;
              return (
                <option key={val} value={val}>
                  {MESES[d.getMonth()]} {y}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Mini dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-600 uppercase">Atrasadas</p>
          <p className="text-2xl font-bold text-red-800">{atrasadas.length}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase">Hoy</p>
          <p className="text-2xl font-bold text-amber-800">{tareasHoy.length}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase">Esta semana</p>
          <p className="text-2xl font-bold text-blue-800">{semana.length}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-600 uppercase">Clientes marketing</p>
          <p className="text-2xl font-bold text-slate-800">{clientesMarketing.length}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-600 uppercase">Cumplimiento {mes}</p>
          <p className="text-2xl font-bold text-green-800">{metricas.porcentaje}%</p>
          <p className="text-xs text-green-600">{metricas.completadas}/{metricas.total} tareas</p>
        </div>
      </div>

      {/* Sync modal */}
      {syncMostrarPreview && syncPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSyncMostrarPreview(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-4">Preview de sincronización — {mes}</h3>
            <div className="space-y-4 text-sm">
              <p><strong>{syncPreview.clientes_a_marcar_count}</strong> clientes a marcar como marketing</p>
              <p><strong>{syncPreview.tareas_a_generar_count}</strong> tareas a generar</p>
              {syncPreview.clientes_a_marcar.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Clientes:</p>
                  <ul className="list-disc pl-4 text-slate-600">
                    {syncPreview.clientes_a_marcar.slice(0, 5).map((c) => (
                      <li key={c.id}>{c.nombre}</li>
                    ))}
                    {syncPreview.clientes_a_marcar.length > 5 && <li>…y {syncPreview.clientes_a_marcar.length - 5} más</li>}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleExecuteSync}
                disabled={syncEjecutando}
                className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {syncEjecutando ? "Ejecutando…" : "Ejecutar sincronización"}
              </button>
              <button type="button" onClick={() => setSyncMostrarPreview(false)} className="border border-slate-200 px-4 py-2 rounded-lg text-sm hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Filtrar por cliente"
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-48"
        />
        <input
          type="text"
          placeholder="Filtrar por responsable"
          value={filtroResponsable}
          onChange={(e) => setFiltroResponsable(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 w-48"
        />
      </div>

      {/* Vista calendario por mes */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <h2 className="bg-slate-50 border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
          {MESES[mesNum - 1]} {ano} — Tareas por día
        </h2>
        <div className="p-4 overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[600px] gap-1" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-slate-500 py-1">
                {d}
              </div>
            ))}
            {Array.from({ length: diasDelMes[0] ? new Date(diasDelMes[0] + "T12:00:00Z").getUTCDay() : 0 }, (_, i) => (
              <div key={`e-${i}`} className="min-h-[80px]" />
            ))}
            {diasDelMes.map((fecha) => {
              const d = new Date(fecha + "T12:00:00Z").getUTCDay();
              const tareasDia = grupoPorDia.get(fecha) ?? [];
              const esHoy = fecha === hoy;
              return (
                <div
                  key={fecha}
                  className={`min-h-[80px] p-2 rounded-lg border ${
                    esHoy ? "border-[#0EA5E9] bg-sky-50" : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <span className="text-xs font-medium text-slate-600">{fecha.slice(8)}</span>
                  <div className="mt-1 space-y-1">
                    {tareasDia.slice(0, 3).map((t) => (
                      <Link
                        key={t.id}
                        href={`/clientes/${t.cliente_id}`}
                        className="block text-xs truncate px-1.5 py-0.5 rounded bg-white border border-slate-100 hover:border-[#0EA5E9]"
                      >
                        {clienteMap.get(t.cliente_id)?.slice(0, 12)} — {t.tipo_contenido}
                      </Link>
                    ))}
                    {tareasDia.length > 3 && <span className="text-xs text-slate-400">+{tareasDia.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabla detallada */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <h2 className="bg-slate-50 border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
          Lista de tareas
        </h2>
        {tareasFiltradas.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p>No hay tareas este mes.</p>
            <p className="text-sm mt-1">Configurá planes de marketing y ejecutá la sincronización.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Título", "Tipo", "Estado", "Fecha", "Cliente", "Responsable", "Origen", ""].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-600 px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tareasFiltradas.map((t) => (
                  <TaskRow
                    key={t.id}
                    tarea={t}
                    clienteNombre={clienteMap.get(t.cliente_id) ?? "—"}
                    usuarioNombre={t.responsable_user_id ? usuarioMap.get(t.responsable_user_id) ?? "—" : "—"}
                    origen={t.generada_automaticamente ? "Plan" : "Manual"}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
