"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X, RefreshCw, Filter, Copy, Tag as TagIcon } from "lucide-react";

/**
 * Etiquetas Automáticas - Pantalla productiva.
 * Fuente única: conversaciones con `current_tag_id` vigente (estado real).
 * No expone snapshots, dry_run, run_keys, batches ni acciones técnicas.
 */

interface AvailableTag {
  tag_code: string;
  tag_label: string;
  color: string | null;
  sort_order: number;
}

interface ByCurrentTagRow {
  tag_code: string;
  tag_label: string;
  n: number;
}

interface CountersResponse {
  ok: boolean;
  counters?: {
    hidden_by_tag_total: number;
    current_tag_total: number;
  };
  by_current_tag?: ByCurrentTagRow[];
  available_tags?: AvailableTag[];
}

interface CurrentTagRow {
  conversation_id: string;
  contact_id: string | null;
  tag_code: string;
  tag_label: string;
  phone: string | null;
  contact_name: string | null;
  last_message_at: string | null;
  last_tagged_at: string | null;
  days_idle: number | null;
}

interface CurrentResponse {
  ok: boolean;
  error?: string;
  pagination?: { limit: number; offset: number; total: number };
  rows?: CurrentTagRow[];
}

interface ConversationPreviewMessage {
  id: string;
  from_me: boolean;
  sender_type: string | null;
  message_type: string | null;
  content: string | null;
  created_at: string | null;
  whatsapp_delivery_status: string | null;
}

interface ConversationPreviewResponse {
  ok: boolean;
  error?: string;
  conversation?: {
    conversation_id: string;
    status: string | null;
    flow_current_node: string | null;
    last_message_at: string | null;
    contact: {
      contact_id: string | null;
      name: string | null;
      phone: string | null;
      phone_masked: string | null;
    };
  };
  messages?: ConversationPreviewMessage[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-PY", { dateStyle: "short", timeStyle: "short" });
}

const TAG_COLOR: Record<string, string> = {
  compro_varias: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  compro_boleta: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  comprobante_pendiente: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  datos_incompletos: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  no_compro: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  recomprador: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  abandonado: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
};

function tagPillClass(code: string): string {
  return TAG_COLOR[code] ?? "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

const INPUT_CN =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 hover:border-[#4FAEB2]/60 focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/20";
const SELECT_CN =
  "w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-[#4FAEB2]/60 focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/20";
const BTN_PRIMARY_CN =
  "inline-flex items-center gap-1.5 rounded-xl bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#4FAEB2]/25 transition-colors hover:bg-[#3F8E91] disabled:opacity-50";
const BTN_SECONDARY_CN =
  "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#4FAEB2]/60 hover:bg-[#4FAEB2]/5 hover:text-[#3F8E91] disabled:opacity-50";

export default function EtiquetasClient() {
  // Filtros (estado de inputs).
  const [tagCode, setTagCode] = useState("");
  const [phone, setPhone] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Data
  const [availableTags, setAvailableTags] = useState<AvailableTag[]>([]);
  const [byCurrentTag, setByCurrentTag] = useState<ByCurrentTagRow[]>([]);
  const [totalEtiquetadas, setTotalEtiquetadas] = useState(0);
  const [rows, setRows] = useState<CurrentTagRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasSearched, setHasSearched] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<{
    tagCode: string; phone: string; dateFrom: string; dateTo: string;
  } | null>(null);

  // Modal
  const [modalConvId, setModalConvId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalData, setModalData] = useState<ConversationPreviewResponse | null>(null);

  const filtersActiveCount = useMemo(() => {
    let n = 0;
    if (tagCode) n++;
    if (phone) n++;
    if (dateFrom) n++;
    if (dateTo) n++;
    return n;
  }, [tagCode, phone, dateFrom, dateTo]);

  // Counters (live)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/tags/counters`, { cache: "no-store" });
        const json: CountersResponse = await res.json();
        if (cancelled || !json.ok) return;
        setAvailableTags(json.available_tags ?? []);
        setByCurrentTag(json.by_current_tag ?? []);
        setTotalEtiquetadas(json.counters?.current_tag_total ?? json.counters?.hidden_by_tag_total ?? 0);
      } catch {
        /* counters opcionales */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const buildQuery = useCallback(
    (f: { tagCode: string; phone: string; dateFrom: string; dateTo: string }, off: number) => {
      const sp = new URLSearchParams();
      if (f.tagCode) sp.set("tag_code", f.tagCode);
      if (f.phone) sp.set("phone", f.phone);
      if (f.dateFrom) sp.set("date_from", f.dateFrom);
      if (f.dateTo) sp.set("date_to", f.dateTo);
      sp.set("limit", String(limit));
      sp.set("offset", String(off));
      return sp.toString();
    },
    [limit]
  );

  const fetchData = useCallback(
    async (f: { tagCode: string; phone: string; dateFrom: string; dateTo: string }, off: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/chat/tags/current?${buildQuery(f, off)}`, { cache: "no-store" });
        const json: CurrentResponse = await res.json();
        if (!json.ok) {
          setError(json.error || "Error al cargar");
          setRows([]);
          setTotal(0);
          return;
        }
        setRows(json.rows ?? []);
        setTotal(json.pagination?.total ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  const handleSearch = useCallback(() => {
    if (filtersActiveCount === 0) {
      setError("Elegí al menos un filtro para consultar.");
      return;
    }
    const next = { tagCode, phone, dateFrom, dateTo };
    setAppliedFilters(next);
    setOffset(0);
    setHasSearched(true);
    void fetchData(next, 0);
  }, [filtersActiveCount, tagCode, phone, dateFrom, dateTo, fetchData]);

  const handleReload = useCallback(() => {
    if (!appliedFilters) {
      setError("Aplicá un filtro primero.");
      return;
    }
    void fetchData(appliedFilters, offset);
  }, [appliedFilters, offset, fetchData]);

  const handlePage = useCallback(
    (newOffset: number) => {
      if (!appliedFilters) return;
      setOffset(newOffset);
      void fetchData(appliedFilters, newOffset);
    },
    [appliedFilters, fetchData]
  );

  const resetFilters = useCallback(() => {
    setTagCode("");
    setPhone("");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
    setAppliedFilters(null);
    setRows([]);
    setTotal(0);
    setHasSearched(false);
    setError(null);
  }, []);

  const openModal = useCallback(async (conversationId: string) => {
    setModalConvId(conversationId);
    setModalData(null);
    setModalError(null);
    setModalLoading(true);
    try {
      const res = await fetch(
        `/api/chat/tags/conversation-preview?conversation_id=${encodeURIComponent(conversationId)}&limit=50`,
        { cache: "no-store" }
      );
      const json: ConversationPreviewResponse = await res.json();
      if (!json.ok) setModalError(json.error || "Error al cargar conversación");
      else setModalData(json);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setModalLoading(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setModalConvId(null);
    setModalData(null);
    setModalError(null);
  }, []);

  // Conteo por tag para cards (merge con catálogo).
  const cardData = useMemo(() => {
    const byCode = new Map(byCurrentTag.map((r) => [r.tag_code, r]));
    const cards: Array<{ tag_code: string; tag_label: string; n: number }> = [];
    // Orden estable según availableTags (sort_order del catálogo).
    for (const t of availableTags) {
      const found = byCode.get(t.tag_code);
      cards.push({ tag_code: t.tag_code, tag_label: t.tag_label, n: found?.n ?? 0 });
    }
    // Tags vigentes sin entrada en availableTags (raro): agregar al final.
    for (const r of byCurrentTag) {
      if (!availableTags.find((t) => t.tag_code === r.tag_code)) {
        cards.push(r);
      }
    }
    return cards;
  }, [byCurrentTag, availableTags]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="block h-7 w-1.5 rounded-full bg-[#4FAEB2]" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Etiquetas Automáticas</h1>
            <p className="mt-1 text-sm text-slate-500">
              Consultá las conversaciones clasificadas automáticamente según el estado del WhatsApp.
            </p>
          </div>
        </div>
        <div className="inline-flex max-w-md items-start gap-2 rounded-xl border border-[#4FAEB2]/30 bg-[#4FAEB2]/5 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm">
          <TagIcon size={14} className="mt-0.5 shrink-0 text-[#4FAEB2]" />
          <span>
            Las conversaciones etiquetadas salen de Conversaciones. Si el cliente vuelve a escribir, reaparecen automáticamente.
          </span>
        </div>
      </header>

      {/* Cards: total + por etiqueta */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-[#4FAEB2]/45 bg-white p-4 shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Total etiquetadas</div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900">
            {totalEtiquetadas.toLocaleString("es-PY")}
          </div>
        </div>
        {cardData.map((c) => {
          const active = tagCode === c.tag_code;
          return (
            <button
              key={c.tag_code}
              onClick={() => {
                const next = c.tag_code === tagCode ? "" : c.tag_code;
                setTagCode(next);
                if (appliedFilters) {
                  const applied = { ...appliedFilters, tagCode: next };
                  setAppliedFilters(applied);
                  setOffset(0);
                  void fetchData(applied, 0);
                }
              }}
              className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors ${
                active
                  ? "border-[#4FAEB2] ring-2 ring-[#4FAEB2]/25"
                  : "border-slate-200 hover:border-[#4FAEB2]/60 hover:bg-[#4FAEB2]/5"
              }`}
              type="button"
            >
              <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
                {c.tag_label || c.tag_code}
              </div>
              <div className="mt-1.5 text-2xl font-semibold text-slate-900">
                {c.n.toLocaleString("es-PY")}
              </div>
            </button>
          );
        })}
      </section>

      {/* Filtros */}
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[#4FAEB2]" />
          <h2 className="text-sm font-semibold text-slate-700">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Etiqueta</label>
            <select
              value={tagCode}
              onChange={(e) => setTagCode(e.target.value)}
              className={SELECT_CN}
            >
              <option value="">Todas las etiquetas</option>
              {availableTags.map((t) => (
                <option key={t.tag_code} value={t.tag_code}>{t.tag_label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Teléfono / Número (parcial)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej. 2713"
              className={INPUT_CN}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Último mensaje desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={INPUT_CN}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Último mensaje hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={INPUT_CN}
            />
          </div>
        </div>
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={handleSearch}
          className={BTN_PRIMARY_CN}
          type="button"
          disabled={loading || filtersActiveCount === 0}
          title={filtersActiveCount === 0 ? "Elegí al menos un filtro para consultar." : undefined}
        >
          <Filter size={14} />
          Buscar
        </button>
        <button
          onClick={handleReload}
          className={BTN_SECONDARY_CN}
          type="button"
          disabled={loading || !appliedFilters}
          title={!appliedFilters ? "Aplicá un filtro primero." : undefined}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Recargar
        </button>
        <button
          onClick={resetFilters}
          className={BTN_SECONDARY_CN}
          type="button"
        >
          Limpiar filtros
        </button>
        <div className="ml-auto text-xs text-slate-500">
          {loading
            ? "Cargando…"
            : !hasSearched
              ? filtersActiveCount === 0
                ? "Elegí al menos un filtro y presioná Buscar."
                : `${filtersActiveCount} filtro(s) listos. Presioná Buscar.`
              : `Mostrando ${rows.length} de ${total.toLocaleString("es-PY")}`}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}

      {/* Tabla */}
      {!hasSearched ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Filter className="mx-auto mb-3 h-8 w-8 text-[#4FAEB2]" />
          <h3 className="text-base font-semibold text-slate-800">Aplicá un filtro para consultar etiquetas.</h3>
          <p className="mt-1 text-sm text-slate-500">
            Elegí una etiqueta, número o rango de fechas y presioná
            <span className="mx-1 font-medium text-slate-700">Buscar</span>.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#4FAEB2]/45 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Etiqueta</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Teléfono / Número</th>
                <th className="px-4 py-3">Último mensaje</th>
                <th className="px-4 py-3">Días inactivo</th>
                <th className="px-4 py-3">Fecha etiquetada</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Sin resultados para los filtros seleccionados.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.conversation_id} className="transition-colors hover:bg-[#4FAEB2]/5">
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tagPillClass(r.tag_code)}`}>
                      {r.tag_label || r.tag_code}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {r.contact_name || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm font-semibold text-slate-800 tracking-wider">
                    {r.phone || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDate(r.last_message_at)}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {r.days_idle != null ? `${r.days_idle}d` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDate(r.last_tagged_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const full = (r.phone || "").replace(/\D+/g, "");
                          if (full) void navigator.clipboard.writeText(full);
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:border-[#4FAEB2]/60 hover:bg-[#4FAEB2]/5 hover:text-[#3F8E91]"
                        title="Copiar número completo"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openModal(r.conversation_id)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:border-[#4FAEB2]/60 hover:bg-[#4FAEB2]/5 hover:text-[#3F8E91]"
                        title="Ver últimos mensajes"
                      >
                        <Search size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {hasSearched && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Offset: {offset}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0 || loading}
              onClick={() => handlePage(Math.max(0, offset - limit))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#4FAEB2]/60 hover:bg-[#4FAEB2]/5 hover:text-[#3F8E91] disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={offset + limit >= total || loading}
              onClick={() => handlePage(offset + limit)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#4FAEB2]/60 hover:bg-[#4FAEB2]/5 hover:text-[#3F8E91] disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalConvId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#4FAEB2]/45 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {modalData?.conversation?.contact?.name || "Conversación"}
                </div>
                <div className="truncate font-mono text-xs text-slate-500">
                  {modalData?.conversation?.contact?.phone || modalData?.conversation?.contact?.phone_masked || modalConvId.slice(0, 8)}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition-colors hover:border-[#4FAEB2]/60 hover:bg-[#4FAEB2]/5 hover:text-[#3F8E91]"
                type="button"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
              {modalLoading && (
                <div className="text-center text-sm text-slate-500">
                  Cargando últimos 50 mensajes…
                </div>
              )}
              {modalError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {modalError}
                </div>
              )}
              {modalData?.messages?.length === 0 && !modalLoading && (
                <div className="text-center text-sm text-slate-500">Sin mensajes.</div>
              )}
              {modalData?.messages?.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-2xl border px-3 py-2 shadow-sm ${
                    m.from_me
                      ? "ml-auto border-[#4FAEB2]/30 bg-[#4FAEB2]/10 text-slate-800"
                      : "mr-auto border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                    {m.from_me ? "Saliente" : "Entrante"} · {m.message_type || "text"}
                  </div>
                  <div className="whitespace-pre-wrap break-words text-sm">
                    {m.content || <span className="italic text-slate-400">(sin contenido)</span>}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">{formatDate(m.created_at)}</div>
                </div>
              ))}
            </div>
            <footer className="border-t border-slate-200 bg-white p-3 text-[11px] text-slate-500">
              Vista de conversación. No envía mensajes ni modifica el chat.
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
