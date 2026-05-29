import "server-only";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

type Stats = {
  partners: number;
  linksActivos: number;
  clicks: number;
  conversiones: number;
  comisionPendiente: number;
};

async function tableExists(name: string): Promise<boolean> {
  const pool = getChatPostgresPool();
  if (!pool) return false;
  const { rows } = await queryWithRetry<{ e: boolean }>(
    pool,
    `SELECT EXISTS (
       SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname='alquiloya' AND c.relname=$1 AND c.relkind='r'
     ) AS e`,
    [name]
  );
  return rows?.[0]?.e === true;
}

async function loadStats(): Promise<Stats> {
  const empty: Stats = {
    partners: 0,
    linksActivos: 0,
    clicks: 0,
    conversiones: 0,
    comisionPendiente: 0,
  };
  const pool = getChatPostgresPool();
  if (!pool) return empty;
  if (!(await tableExists("referral_partners"))) return empty;

  try {
    const [{ rows: p }, { rows: l }, { rows: c }, { rows: cv }, { rows: cm }] = await Promise.all([
      queryWithRetry<{ n: number }>(
        pool,
        `SELECT count(*)::int AS n FROM alquiloya.referral_partners WHERE empresa_id=$1::uuid`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{ n: number }>(
        pool,
        `SELECT count(*)::int AS n FROM alquiloya.referral_links WHERE empresa_id=$1::uuid AND activo=true`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{ n: number }>(
        pool,
        `SELECT count(*)::int AS n FROM alquiloya.referral_clicks WHERE empresa_id=$1::uuid`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{ n: number }>(
        pool,
        `SELECT count(*)::int AS n FROM alquiloya.referral_conversions WHERE empresa_id=$1::uuid`,
        [ALQUILOYA_EMPRESA_ID]
      ),
      queryWithRetry<{ n: string | null }>(
        pool,
        `SELECT COALESCE(sum(monto_comision),0)::text AS n
           FROM alquiloya.referral_commissions
          WHERE empresa_id=$1::uuid AND estado='pendiente'`,
        [ALQUILOYA_EMPRESA_ID]
      ),
    ]);
    return {
      partners: p[0]?.n ?? 0,
      linksActivos: l[0]?.n ?? 0,
      clicks: c[0]?.n ?? 0,
      conversiones: cv[0]?.n ?? 0,
      comisionPendiente: Number(cm[0]?.n ?? "0"),
    };
  } catch {
    return empty;
  }
}

type Partner = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  tipo: string | null;
  activo: boolean;
  links_count: number;
  conversiones_count: number;
};

async function loadPartners(): Promise<Partner[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  if (!(await tableExists("referral_partners"))) return [];
  try {
    const { rows } = await queryWithRetry<Partner>(
      pool,
      `
        SELECT
          p.id, p.nombre, p.email, p.telefono, p.tipo, p.activo,
          COALESCE(lk.n, 0)::int AS links_count,
          COALESCE(cv.n, 0)::int AS conversiones_count
        FROM alquiloya.referral_partners p
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS n
            FROM alquiloya.referral_links
           WHERE partner_id = p.id AND activo = true
        ) lk ON true
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS n
            FROM alquiloya.referral_conversions
           WHERE partner_id = p.id
        ) cv ON true
        WHERE p.empresa_id = $1::uuid
        ORDER BY p.created_at DESC NULLS LAST, lower(p.nombre) ASC
      `,
      [ALQUILOYA_EMPRESA_ID]
    );
    return rows ?? [];
  } catch {
    return [];
  }
}

function fmt(n: number): string {
  try { return new Intl.NumberFormat("es-PY").format(n); } catch { return String(n); }
}
function fmtGs(n: number): string {
  try {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      maximumFractionDigits: 0,
    }).format(n);
  } catch { return `Gs. ${n.toLocaleString("es-PY")}`; }
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div> : null}
    </div>
  );
}

export default async function ReferidosPage() {
  const [stats, partners] = await Promise.all([loadStats(), loadPartners()]);

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Referidos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Programa de referidos, influencers y aliados. Acá vas a crear partners,
            asignarles un link único y configurar la comisión.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Disponible en la próxima fase"
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-400 ring-1 ring-slate-200"
        >
          + Nuevo referido
        </button>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Partners" value={fmt(stats.partners)} sub="referidos / influencers" />
        <StatCard label="Links activos" value={fmt(stats.linksActivos)} sub="slugs en uso" />
        <StatCard label="Clicks" value={fmt(stats.clicks)} sub="acumulado" />
        <StatCard label="Conversiones" value={fmt(stats.conversiones)} sub="atribuidas" />
        <StatCard label="Comisión pendiente" value={fmtGs(stats.comisionPendiente)} sub="por pagar" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Referidos / partners</h2>
          <span className="text-[11px] text-slate-400">
            {partners.length} {partners.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {partners.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Todavía no hay referidos cargados. Cuando se creen partners,
            aparecerán acá con sus links, conversiones y comisiones.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Nombre</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Teléfono</th>
                  <th className="px-4 py-2.5 text-center">Links</th>
                  <th className="px-4 py-2.5 text-center">Conversiones</th>
                  <th className="px-4 py-2.5">Activo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partners.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{p.nombre}</td>
                    <td className="px-4 py-2 text-slate-700">{p.tipo ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{p.email ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{p.telefono ?? "—"}</td>
                    <td className="px-4 py-2 text-center tabular-nums">{p.links_count}</td>
                    <td className="px-4 py-2 text-center tabular-nums">{p.conversiones_count}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                          p.activo
                            ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                        }`}
                      >
                        {p.activo ? "Sí" : "No"}
                      </span>
                    </td>
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
