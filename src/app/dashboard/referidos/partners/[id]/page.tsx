import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { CopySlugButton } from "../../_components/CopySlugButton";
import { PartnerActions } from "./_components/PartnerActions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Partner = {
  id: string; nombre: string; email: string | null; telefono: string | null;
  tipo: string | null; notas: string | null; activo: boolean;
  usuario_id: string | null; created_at: string | null;
};
type LinkRow = {
  id: string; slug: string; campania: string | null; cookie_dias: number;
  activo: boolean; created_at: string | null;
};
type Rule = {
  id: string; tipo: string; valor: number; moneda: string | null;
  recurrente: boolean; meses_recurrencia: number | null;
};
type Stats = { clicks: number; conversiones: number; pendiente: number; pagada: number };
type Acceso = { id: string; email: string | null; rol: string | null; activo: boolean | null };
type Commission = {
  id: string; periodo: string | null; monto: number; estado: string;
  generada_at: string | null; pagada_at: string | null;
};

async function load(id: string) {
  const pool = getChatPostgresPool();
  if (!pool) return null;

  const p = await queryWithRetry<Partner>(
    pool,
    `SELECT id, nombre, email, telefono, tipo, notas, activo, usuario_id, created_at::text AS created_at
       FROM alquiloya.referral_partners
      WHERE empresa_id=$1::uuid AND id=$2::uuid LIMIT 1`,
    [ALQUILOYA_EMPRESA_ID, id]
  );
  if (!p.rows || p.rows.length === 0) return null;
  const partner = p.rows[0];

  const [links, rule, stats, comm, acceso] = await Promise.all([
    queryWithRetry<LinkRow>(
      pool,
      `SELECT id, slug, campania, cookie_dias, activo, created_at::text AS created_at
         FROM alquiloya.referral_links
        WHERE empresa_id=$1::uuid AND partner_id=$2::uuid
        ORDER BY activo DESC, created_at ASC`,
      [ALQUILOYA_EMPRESA_ID, id]
    ),
    queryWithRetry<Rule>(
      pool,
      `SELECT id, tipo, valor::float8 AS valor, moneda, recurrente, meses_recurrencia
         FROM alquiloya.referral_commission_rules
        WHERE empresa_id=$1::uuid AND partner_id=$2::uuid AND vigente_hasta IS NULL
        ORDER BY vigente_desde DESC LIMIT 1`,
      [ALQUILOYA_EMPRESA_ID, id]
    ),
    queryWithRetry<{ clicks: number; conversiones: number; pendiente: string; pagada: string }>(
      pool,
      `SELECT
         (SELECT count(*)::int FROM alquiloya.referral_clicks
           WHERE link_id IN (SELECT id FROM alquiloya.referral_links WHERE partner_id=$2::uuid))
         AS clicks,
         (SELECT count(*)::int FROM alquiloya.referral_conversions
           WHERE partner_id=$2::uuid) AS conversiones,
         (SELECT COALESCE(sum(monto_comision),0)::text FROM alquiloya.referral_commissions
           WHERE partner_id=$2::uuid AND estado='pendiente') AS pendiente,
         (SELECT COALESCE(sum(monto_comision),0)::text FROM alquiloya.referral_commissions
           WHERE partner_id=$2::uuid AND estado='pagada') AS pagada
       WHERE TRUE`,
      [ALQUILOYA_EMPRESA_ID, id]
    ),
    queryWithRetry<Commission>(
      pool,
      `SELECT id, periodo, monto_comision::float8 AS monto, estado,
              generada_at::text AS generada_at, pagada_at::text AS pagada_at
         FROM alquiloya.referral_commissions
        WHERE empresa_id=$1::uuid AND partner_id=$2::uuid
        ORDER BY generada_at DESC LIMIT 20`,
      [ALQUILOYA_EMPRESA_ID, id]
    ),
    (async () => {
      if (!partner.usuario_id) return null;
      const r = await queryWithRetry<Acceso>(
        pool,
        `SELECT id, email, rol, activo FROM alquiloya.usuarios
          WHERE id=$1::uuid AND empresa_id=$2::uuid LIMIT 1`,
        [partner.usuario_id, ALQUILOYA_EMPRESA_ID]
      );
      return r.rows?.[0] ?? null;
    })(),
  ]);

  const st = stats.rows[0];
  return {
    partner,
    links: links.rows ?? [],
    rule: rule.rows?.[0] ?? null,
    stats: {
      clicks: st?.clicks ?? 0,
      conversiones: st?.conversiones ?? 0,
      pendiente: Number(st?.pendiente ?? "0"),
      pagada: Number(st?.pagada ?? "0"),
    } satisfies Stats,
    commissions: comm.rows ?? [],
    acceso,
  };
}

function fmt(n: number): string { try { return new Intl.NumberFormat("es-PY").format(n); } catch { return String(n); } }
function fmtGs(n: number): string {
  try { return new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(n); }
  catch { return `Gs. ${n.toLocaleString("es-PY")}`; }
}
function fmtRule(r: Rule | null): string {
  if (!r) return "—";
  const rec = r.recurrente ? ` × ${r.meses_recurrencia ?? "?"}m` : "";
  if (r.tipo === "porcentaje") return `${r.valor}%${rec}`;
  return `${r.moneda ?? "PYG"} ${r.valor.toLocaleString("es-PY")}${rec}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value ?? <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidRe.test(id)) notFound();
  const data = await load(id);
  if (!data) notFound();
  const { partner, links, rule, stats, commissions, acceso } = data;
  const primary = links.find((l) => l.activo) ?? links[0] ?? null;

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/dashboard/referidos"
            className="mb-2 inline-flex text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
          >
            ← Volver al listado
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{partner.nombre}</h1>
          <p className="mt-1 text-sm text-slate-500">{(partner.tipo ?? "—").replace("_", " ")}</p>
        </div>
        <PartnerActions
          partnerId={partner.id}
          activo={partner.activo}
          hasUsuario={!!partner.usuario_id}
          defaultEmail={partner.email}
        />
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Datos</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="Email" value={partner.email} />
            <Field label="Teléfono" value={partner.telefono} />
            <Field label="Tipo" value={(partner.tipo ?? "—").replace("_", " ")} />
            <Field label="Activo" value={partner.activo ? "Sí" : "No"} />
            <Field label="Alta" value={partner.created_at?.slice(0, 19)?.replace("T", " ") ?? "—"} />
            <Field label="Comisión" value={fmtRule(rule)} />
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notas</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                {partner.notas ?? <span className="text-slate-400">—</span>}
              </dd>
            </div>
          </dl>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">Acceso al portal</h2>
          {acceso ? (
            <div className="space-y-2 text-sm">
              <Field label="Email" value={acceso.email} />
              <Field label="Rol" value={acceso.rol} />
              <Field label="Estado" value={acceso.activo ? "Activo" : "Inactivo"} />
              <div className="mt-3 text-[11px] text-slate-400">
                El referido puede ingresar en{" "}
                <span className="font-mono">/portal-referidos/login</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              Sin acceso creado.{" "}
              <span className="text-slate-400">
                Usá el botón <strong>Crear acceso</strong> arriba para habilitarlo.
              </span>
            </div>
          )}
        </aside>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card label="Clicks" value={fmt(stats.clicks)} />
        <Card label="Conversiones" value={fmt(stats.conversiones)} />
        <Card label="Comisión pendiente" value={fmtGs(stats.pendiente)} />
        <Card label="Comisión pagada" value={fmtGs(stats.pagada)} />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Links</h2>
          {primary ? (
            <span className="text-[11px] text-slate-400">
              Principal: <span className="font-mono">/r/{primary.slug}</span>
            </span>
          ) : null}
        </div>
        {links.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500">Sin links.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Slug</th>
                  <th className="px-4 py-2.5">Campaña</th>
                  <th className="px-4 py-2.5 text-center">Cookie (días)</th>
                  <th className="px-4 py-2.5">Activo</th>
                  <th className="px-4 py-2.5 text-right">Copiar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {links.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-[12.5px] text-[#3F8E91]">/r/{l.slug}</td>
                    <td className="px-4 py-2 text-slate-700">{l.campania ?? "—"}</td>
                    <td className="px-4 py-2 text-center tabular-nums">{l.cookie_dias}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                          l.activo
                            ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                        }`}
                      >
                        {l.activo ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <CopySlugButton slug={l.slug} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Últimas comisiones</h2>
        </div>
        {commissions.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500">
            Todavía no hay comisiones registradas.
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
                {commissions.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-mono text-[12px] text-slate-700">{c.periodo ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtGs(c.monto)}</td>
                    <td className="px-4 py-2 text-slate-700">{c.estado}</td>
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
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
    </div>
  );
}
