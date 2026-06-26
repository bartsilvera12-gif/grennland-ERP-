import "server-only";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getClientSchema, getClientEmpresaId } from "@/lib/env/instance-mode";

const ALQUILOYA_SCHEMA = getClientSchema();
export const EMPRESA_ID = getClientEmpresaId();

function q(table: string): string {
  return `"${ALQUILOYA_SCHEMA}"."${table}"`;
}

export type TestimonioRow = {
  id: string;
  autor: string;
  rol: string | null;
  ciudad: string | null;
  contenido: string;
  foto_url: string | null;
  calificacion: number;
  orden: number;
  activo: boolean;
  destacado: boolean;
  created_at: string | null;
};

async function tableExists(): Promise<boolean> {
  const pool = getChatPostgresPool();
  if (!pool) return false;
  const { rows } = await queryWithRetry<{ exists: boolean }>(
    pool,
    `SELECT EXISTS (
       SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = 'testimonios' AND c.relkind = 'r'
     ) AS exists`,
    [ALQUILOYA_SCHEMA]
  );
  return rows?.[0]?.exists === true;
}

export async function listErpTestimonios(): Promise<TestimonioRow[]> {
  const pool = getChatPostgresPool();
  if (!pool) return [];
  if (!(await tableExists())) return [];
  const { rows } = await queryWithRetry<TestimonioRow>(
    pool,
    `SELECT id, autor, rol, ciudad, contenido, foto_url, calificacion,
            orden, activo, destacado, created_at::text AS created_at
       FROM ${q("testimonios")}
      WHERE empresa_id = $1::uuid
      ORDER BY orden ASC, created_at DESC NULLS LAST`,
    [EMPRESA_ID]
  );
  return rows ?? [];
}
