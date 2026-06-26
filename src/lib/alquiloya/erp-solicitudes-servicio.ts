import "server-only";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getClientSchema, getClientEmpresaId } from "@/lib/env/instance-mode";

const ALQUILOYA_SCHEMA = getClientSchema();
export const EMPRESA_ID = getClientEmpresaId();

function q(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

export type SolicitudServicioRow = {
  id: string;
  kind: "cambio_plan" | "impulsos" | "verificacion";
  nombre: string;
  email: string | null;
  telefono: string | null;
  propiedad_id: string | null;
  propietario_id: string | null;
  agente_id: string | null;
  plan_tier: string | null;
  plan_nombre: string | null;
  pack_id: string | null;
  pack_qty: number | null;
  monto: number | null;
  mensaje: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  motivo_rechazo: string | null;
  resultado_id: string | null;
  created_at: string | null;
  revisado_at: string | null;
  propiedad_titulo: string | null;
};

async function tableExists(): Promise<boolean> {
  const pool = getChatPostgresPool();
  if (!pool) return false;
  const { rows } = await queryWithRetry<{ exists: boolean }>(
    pool,
    `SELECT EXISTS (
       SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = 'solicitudes_servicio' AND c.relkind = 'r'
     ) AS exists`,
    [ALQUILOYA_SCHEMA]
  );
  return rows?.[0]?.exists === true;
}

export async function listErpSolicitudesServicio(): Promise<SolicitudServicioRow[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  if (!(await tableExists())) return [];
  const { rows } = await queryWithRetry<SolicitudServicioRow>(
    pool,
    `SELECT s.id, s.kind, s.nombre, s.email, s.telefono,
            s.propiedad_id, s.propietario_id, s.agente_id,
            s.plan_tier, pp.nombre AS plan_nombre,
            s.pack_id, s.pack_qty, s.monto::float8 AS monto,
            s.mensaje, s.estado, s.motivo_rechazo, s.resultado_id,
            s.created_at::text AS created_at,
            s.revisado_at::text AS revisado_at,
            pr.titulo AS propiedad_titulo
       FROM ${q("solicitudes_servicio")} s
       LEFT JOIN ${q("planes_publicacion")} pp
         ON pp.empresa_id = s.empresa_id AND pp.tier = s.plan_tier
       LEFT JOIN ${q("propiedades")} pr
         ON pr.empresa_id = s.empresa_id AND pr.id = s.propiedad_id
      WHERE s.empresa_id = $1::uuid
      ORDER BY (s.estado = 'pendiente') DESC, s.created_at DESC NULLS LAST
      LIMIT 500`,
    [EMPRESA_ID]
  );
  return rows ?? [];
}
