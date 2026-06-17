"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export type AgenteFormData = {
  id?: string;
  nombre: string;
  email: string;
  telefono: string;
  whatsapp: string;
  cargo: string;
  bio: string;
  foto_url: string;
  logo_empresa_url: string;
  orden: number;
  activo: boolean;
  verificado: boolean;
  nivel: string;
  idiomas: string;
  tiempo_respuesta: string;
  tasa_respuesta: string;
  plan_publicacion_id: string;
  plan_vencimiento_at: string;
};

type PlanRow = {
  id: string;
  tier: string | null;
  nombre: string | null;
  billing: string | null;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-600";
const fieldCls = "space-y-1.5";

export function AgenteForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial: AgenteFormData;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AgenteFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [planes, setPlanes] = useState<PlanRow[] | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [fotoErr, setFotoErr] = useState<string | null>(null);

  async function onPickFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFotoErr(null);
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) {
      setFotoErr("Formato no válido. Usá JPG, PNG o WEBP.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setFotoErr("La imagen supera el máximo de 4 MB.");
      return;
    }
    setUploadingFoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetchWithSupabaseSession("/api/dashboard/alquiloya-agentes/foto-upload", {
        method: "POST",
        body: fd,
      });
      const data = (await r.json().catch(() => ({}))) as { success?: boolean; foto_url?: string; error?: string };
      if (!r.ok || !data.success || !data.foto_url) {
        throw new Error(data.error ?? `HTTP ${r.status}`);
      }
      set("foto_url", data.foto_url);
    } catch (e) {
      setFotoErr(e instanceof Error ? e.message : "No pudimos subir la foto");
    } finally {
      setUploadingFoto(false);
    }
  }

  function set<K extends keyof AgenteFormData>(k: K, v: AgenteFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Lista de planes de publicacion (mismo endpoint que usa el modal "Cambiar
  // plan" del listado). Permite asignar plan al crear o editar el agente sin
  // tener que abrir el modal aparte.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchWithSupabaseSession("/api/dashboard/alquiloya-planes-publicacion");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const body = (await r.json()) as { data?: { planes?: PlanRow[] }; planes?: PlanRow[] };
        if (cancelled) return;
        setPlanes(body?.data?.planes ?? body?.planes ?? []);
      } catch {
        if (!cancelled) setPlanes([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.nombre.trim()) { setErr("El nombre es obligatorio"); return; }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre,
        email: form.email || null,
        telefono: form.telefono || null,
        whatsapp: form.whatsapp || null,
        cargo: form.cargo || null,
        bio: form.bio || null,
        foto_url: form.foto_url || null,
        logo_empresa_url: form.logo_empresa_url || null,
        orden: form.orden,
        activo: form.activo,
        verificado: form.verificado,
        nivel: form.nivel || null,
        idiomas: form.idiomas || null,
        tiempo_respuesta: form.tiempo_respuesta || null,
        tasa_respuesta: form.tasa_respuesta || null,
        plan_publicacion_id: form.plan_publicacion_id || null,
        plan_vencimiento_at: form.plan_publicacion_id && form.plan_vencimiento_at
          ? new Date(form.plan_vencimiento_at + "T00:00:00").toISOString()
          : null,
      };
      const url =
        mode === "create"
          ? "/api/dashboard/alquiloya-agentes"
          : `/api/dashboard/alquiloya-agentes/${form.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetchWithSupabaseSession(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      const id = data.id ?? form.id;
      router.push(`/dashboard/agentes-inmobiliarios/agentes/${id}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  }

  const cancelHref = mode === "edit" && form.id
    ? `/dashboard/agentes-inmobiliarios/agentes/${form.id}`
    : "/dashboard/agentes-inmobiliarios";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Datos del agente</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={fieldCls}>
            <label className={labelCls}>Nombre *</label>
            <input className={inputCls} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Cargo</label>
            <input className={inputCls} value={form.cargo} onChange={(e) => set("cargo", e.target.value)} placeholder="Agente, Asesor, etc." />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Teléfono</label>
            <input className={inputCls} value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>WhatsApp</label>
            <input className={inputCls} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="ej. 595981000000" />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Foto de perfil</label>
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {form.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.foto_url} alt="Foto" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sin foto</div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input className={inputCls} value={form.foto_url} onChange={(e) => set("foto_url", e.target.value)} placeholder="https://... o subí una imagen" />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                    {uploadingFoto ? "Subiendo…" : form.foto_url ? "Cambiar foto" : "Subir foto"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingFoto} onChange={onPickFoto} />
                  </label>
                  {form.foto_url ? (
                    <button type="button" onClick={() => set("foto_url", "")} className="rounded-lg px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50">
                      Quitar
                    </button>
                  ) : null}
                  <span className="text-[11px] text-slate-500">JPG/PNG/WEBP — máx 4 MB</span>
                </div>
                {fotoErr ? <p className="text-[11px] text-rose-600">{fotoErr}</p> : null}
              </div>
            </div>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>URL del logo de la empresa</label>
            <input className={inputCls} value={form.logo_empresa_url} onChange={(e) => set("logo_empresa_url", e.target.value)} placeholder="https://... (opcional)" />
            <p className="mt-1 text-[11px] text-slate-500">Solo aplica si es una inmobiliaria con marca propia.</p>
          </div>
          <div className={`${fieldCls} sm:col-span-2`}>
            <label className={labelCls}>Bio / Descripción</label>
            <textarea
              className={`${inputCls} min-h-[96px]`}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="Breve descripción visible en la web pública"
            />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Prioridad en listado</label>
            <input
              type="number"
              className={inputCls}
              value={form.orden}
              onChange={(e) => set("orden", Number(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="mt-1 text-[11px] text-slate-500">Menor número = aparece primero en la web pública. Dejá 0 si no querés ordenarlo manualmente.</p>
          </div>
          <div className="flex items-end gap-5">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]"
                checked={form.activo}
                onChange={(e) => set("activo", e.target.checked)}
              />
              Activo
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]"
                checked={form.verificado}
                onChange={(e) => set("verificado", e.target.checked)}
              />
              Verificado (badge azul)
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Perfil público</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={fieldCls}>
            <label className={labelCls}>Nivel</label>
            <select className={inputCls} value={form.nivel} onChange={(e) => set("nivel", e.target.value)}>
              <option value="">— Automático (por cierres) —</option>
              <option value="Junior">Junior</option>
              <option value="Pro">Pro</option>
              <option value="Top Pro">Top Pro</option>
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Idiomas</label>
            <input className={inputCls} value={form.idiomas} onChange={(e) => set("idiomas", e.target.value)} placeholder="Ej. Es · Gn · En" />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Tiempo de respuesta</label>
            <input className={inputCls} value={form.tiempo_respuesta} onChange={(e) => set("tiempo_respuesta", e.target.value)} placeholder="Ej. ~ 12 min" />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Tasa de respuesta</label>
            <input className={inputCls} value={form.tasa_respuesta} onChange={(e) => set("tasa_respuesta", e.target.value)} placeholder="Ej. 98%" />
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Estos campos se muestran en la vista pública del agente. Si dejás <strong>nivel</strong> vacío, se calcula automáticamente
          (Top Pro ≥ 10 cierres, Pro ≥ 3, sino Junior).
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-600">Plan asignado</h2>
        <p className="mb-4 text-[11px] text-slate-500">
          Plan al que se suscribe el agente. Si lo dejás sin plan, queda con capacidad limitada hasta que el admin (o el agente) active uno.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={fieldCls}>
            <label className={labelCls}>Plan</label>
            <select
              className={inputCls}
              value={form.plan_publicacion_id}
              onChange={(e) => set("plan_publicacion_id", e.target.value)}
              disabled={planes === null}
            >
              <option value="">Sin plan</option>
              {(planes ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre ?? p.tier ?? p.id}
                  {p.billing ? ` · ${p.billing}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Vencimiento del plan</label>
            <input
              type="date"
              className={inputCls}
              value={form.plan_vencimiento_at}
              onChange={(e) => set("plan_vencimiento_at", e.target.value)}
              disabled={!form.plan_publicacion_id}
            />
            <p className="mt-1 text-[11px] text-slate-500">Solo se aplica si seleccionás un plan.</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-xl bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] disabled:opacity-60"
        >
          {saving ? "Guardando…" : mode === "create" ? "Crear agente" : "Guardar cambios"}
        </button>
        <Link
          href={cancelHref}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
