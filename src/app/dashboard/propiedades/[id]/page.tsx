import Link from "next/link";
import { notFound } from "next/navigation";
import { getErpPropiedad } from "@/lib/alquiloya/erp-propiedades";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmtPrecio(precio: number | null, moneda: string | null): string {
  if (precio == null) return "—";
  const m = moneda || "USD";
  try {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: m,
      maximumFractionDigits: 0,
    }).format(precio);
  } catch {
    return `${m} ${precio.toLocaleString("es-PY")}`;
  }
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-2 last:border-0">
      <dt className="w-40 shrink-0 text-xs font-medium uppercase tracking-wider text-slate-500">{k}</dt>
      <dd className="text-sm text-slate-800">{v ?? "—"}</dd>
    </div>
  );
}

export default async function PropiedadDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const fromPendientes = sp.from === "pendientes";
  const p = await getErpPropiedad(id);
  if (!p) notFound();

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href={fromPendientes ? "/dashboard/propiedades-pendientes" : "/dashboard/propiedades"}
            className="mb-3 inline-flex items-center text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
          >
            {fromPendientes ? "← Volver a pendientes de aprobación" : "← Volver al listado"}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{p.titulo ?? "Sin título"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {p.codigo ? <span className="mr-2 text-slate-400">{p.codigo}</span> : null}
            {[p.tipo, p.operacion].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <Link
          href={`/dashboard/propiedades/${p.id}/editar`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/40"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Editar
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Datos principales */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">Datos</h2>
          <dl>
            <Row k="Tipo" v={p.tipo} />
            <Row k="Operación" v={p.operacion} />
            <Row k="Estado" v={p.estado} />
            <Row k="Ciudad" v={p.ciudad} />
            <Row k="Barrio" v={p.barrio} />
            <Row k="Dirección" v={p.direccion} />
            <Row k="Precio" v={fmtPrecio(p.precio, p.moneda)} />
            <Row k="Dormitorios" v={p.dormitorios ?? "—"} />
            <Row k="Baños" v={p.banos ?? "—"} />
            <Row k="Cocheras" v={p.cocheras ?? "—"} />
            <Row k="Superficie m²" v={p.superficie_m2 ?? "—"} />
            <Row k="Terreno m²" v={p.terreno_m2 ?? "—"} />
            <Row k="Destacada" v={p.destacada ? "Sí" : "No"} />
            <Row k="Visible web" v={p.visible_web ? "Sí" : "No"} />
            <Row k="Activo" v={p.activo ? "Sí" : "No"} />
            <Row k="Creado" v={p.created_at?.replace("T", " ").slice(0, 19) ?? "—"} />
            <Row k="Actualizado" v={p.updated_at?.replace("T", " ").slice(0, 19) ?? "—"} />
          </dl>
          {p.descripcion ? (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Descripción</h3>
              <p className="whitespace-pre-line text-sm text-slate-700">{p.descripcion}</p>
            </div>
          ) : null}
        </section>

        {/* Agente */}
        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">Agente</h2>
          {p.agente ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {p.agente.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.agente.foto_url}
                    alt={p.agente.nombre ?? ""}
                    className="h-14 w-14 rounded-full object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400">
                    s/f
                  </div>
                )}
                <div>
                  <div className="font-medium text-slate-900">{p.agente.nombre ?? "—"}</div>
                  {p.agente.cargo ? <div className="text-xs text-slate-500">{p.agente.cargo}</div> : null}
                </div>
              </div>
              <dl className="text-sm">
                <Row k="Email" v={p.agente.email} />
                <Row k="Teléfono" v={p.agente.telefono} />
                <Row k="WhatsApp" v={p.agente.whatsapp} />
              </dl>
              {p.agente.bio ? (
                <p className="whitespace-pre-line text-xs text-slate-500">{p.agente.bio}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin agente asignado.</p>
          )}
        </aside>

        {/* Galería */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">
            Galería <span className="ml-1 text-slate-400">({p.fotos.length})</span>
          </h2>
          {p.fotos.length === 0 ? (
            <p className="text-sm text-slate-500">Sin fotos cargadas.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {p.fotos.map((f) => (
                <figure key={f.id} className="overflow-hidden rounded-lg ring-1 ring-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.alt ?? ""} className="aspect-[4/3] w-full object-cover" />
                  {f.es_portada ? (
                    <figcaption className="bg-[#4FAEB2]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#3F8E91]">
                      Portada
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          )}
        </section>

        {/* Características */}
        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">
            Características <span className="ml-1 text-slate-400">({p.caracteristicas.length})</span>
          </h2>
          {p.caracteristicas.length === 0 ? (
            <p className="text-sm text-slate-500">Sin características cargadas.</p>
          ) : (
            <ul className="space-y-2">
              {p.caracteristicas.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
                  <span className="text-sm text-slate-800">{c.nombre ?? "—"}</span>
                  <span className="text-sm text-slate-500">{c.valor ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
