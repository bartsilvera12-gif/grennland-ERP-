import "server-only";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getClientSchema, getClientEmpresaId } from "@/lib/env/instance-mode";

const ALQUILOYA_SCHEMA = getClientSchema();
export const EMPRESA_ID = getClientEmpresaId();

function q(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

export type SolicitudAccesoRow = {
  id: string;
  tipo: "agente" | "propietario" | "referido_partner";
  sub_tipo: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  ciudad: string | null;
  mensaje: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  motivo_rechazo: string | null;
  resultado_id: string | null;
  created_at: string | null;
  revisado_at: string | null;
  plan_tier_solicitado: string | null;
  plan_nombre_solicitado: string | null;
};

async function tableExists(): Promise<boolean> {
  const pool = getChatPostgresPool();
  if (!pool) return false;
  const { rows } = await queryWithRetry<{ exists: boolean }>(
    pool,
    `SELECT EXISTS (
       SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = 'solicitudes_acceso' AND c.relkind = 'r'
     ) AS exists`,
    [ALQUILOYA_SCHEMA]
  );
  return rows?.[0]?.exists === true;
}

export async function listErpSolicitudesAcceso(): Promise<SolicitudAccesoRow[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  if (!(await tableExists())) return [];
  const { rows } = await queryWithRetry<SolicitudAccesoRow>(
    pool,
    `SELECT s.id, s.tipo, s.sub_tipo, s.nombre, s.email, s.telefono, s.empresa, s.ciudad,
            s.mensaje, s.estado, s.motivo_rechazo, s.resultado_id,
            s.created_at::text AS created_at,
            s.revisado_at::text AS revisado_at,
            s.plan_tier_solicitado,
            pp.nombre AS plan_nombre_solicitado
       FROM ${q("solicitudes_acceso")} s
       LEFT JOIN ${q("planes_publicacion")} pp
         ON pp.empresa_id = s.empresa_id
        AND pp.tier = s.plan_tier_solicitado
      WHERE s.empresa_id = $1::uuid
      ORDER BY (s.estado = 'pendiente') DESC, s.created_at DESC NULLS LAST
      LIMIT 500`,
    [EMPRESA_ID]
  );
  return rows ?? [];
}
