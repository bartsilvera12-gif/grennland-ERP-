import type { User } from "@supabase/supabase-js";
import type { ModulosSupabase } from "@/lib/modulos/resolve-effective-modules";
import { usuarioEmailLookupVariants } from "@/lib/auth/usuario-email-variants";
import { SUPABASE_APP_SCHEMA } from "@/lib/supabase/schema";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";

export type UsuarioErpBasico = {
  id: string;
  empresa_id: string | null;
  rol: string | null;
};

/**
 * Fallback directo a Postgres usando el pool compartido — necesario cuando el
 * schema configurado (`NEURA_CLIENT_SCHEMA`) NO está expuesto en PostgREST.
 * Devuelve `null` si el pool no está disponible o no hay match.
 */
async function resolveViaPgPool(
  authUserId: string,
  emails: Iterable<string>
): Promise<UsuarioErpBasico | null> {
  const pool = getChatPostgresPool();
  if (!pool) return null;
  const schema = SUPABASE_APP_SCHEMA;
  const t = `"${schema}"."usuarios"`;
  try {
    const { rows } = await queryWithRetry<UsuarioErpBasico>(
      pool,
      `SELECT id, empresa_id, rol FROM ${t} WHERE auth_user_id = $1::uuid LIMIT 1`,
      [authUserId]
    );
    if (rows && rows.length > 0) return rows[0];
  } catch (e) {
    console.error("[resolveUsuarioErpFromAuthUser pgpool auth_user_id]", (e as Error).message);
  }
  for (const em of emails) {
    if (!em) continue;
    try {
      const { rows } = await queryWithRetry<UsuarioErpBasico>(
        pool,
        `SELECT id, empresa_id, rol FROM ${t} WHERE lower(email) = lower($1) LIMIT 1`,
        [em]
      );
      if (rows && rows.length > 0) return rows[0];
    } catch (e) {
      console.error("[resolveUsuarioErpFromAuthUser pgpool email]", (e as Error).message);
    }
  }
  return null;
}

/**
 * Resuelve la fila `<schema>.usuarios` para la sesión de Auth.
 * Prioridad:
 *   1) PostgREST: `auth_user_id` → emails (JWT + GoTrue admin por si el JWT viene incompleto).
 *   2) Fallback: pg pool directo cuando PostgREST devuelve "Invalid schema" (schema no expuesto).
 */
export async function resolveUsuarioErpFromAuthUser(
  supabase: ModulosSupabase,
  user: User | null
): Promise<UsuarioErpBasico | null> {
  if (!user?.id) return null;

  let postgrestSchemaUnavailable = false;

  const { data: byAuth, error: errAuth } = await supabase
    .from("usuarios")
    .select("id, empresa_id, rol")
    .eq("auth_user_id", user.id)
    .limit(1);
  if (errAuth) {
    console.error("[resolveUsuarioErpFromAuthUser] auth_user_id:", errAuth.message);
    if (/invalid schema/i.test(errAuth.message ?? "")) postgrestSchemaUnavailable = true;
  }
  const hitAuth = byAuth?.[0] as UsuarioErpBasico | undefined;
  if (hitAuth) return hitAuth;

  const emailsToTry = new Set<string>();
  for (const e of usuarioEmailLookupVariants(user.email ?? "")) emailsToTry.add(e);

  if (typeof supabase.auth?.admin?.getUserById === "function") {
    try {
      const { data: adm, error: admErr } = await supabase.auth.admin.getUserById(user.id);
      if (admErr) {
        console.error("[resolveUsuarioErpFromAuthUser] admin.getUserById:", admErr.message);
      } else {
        for (const e of usuarioEmailLookupVariants(adm?.user?.email ?? "")) emailsToTry.add(e);
      }
    } catch (e) {
      console.error("[resolveUsuarioErpFromAuthUser] admin:", e);
    }
  }

  if (!postgrestSchemaUnavailable) {
    for (const em of emailsToTry) {
      const { data: rows, error } = await supabase
        .from("usuarios")
        .select("id, empresa_id, rol")
        .ilike("email", em)
        .limit(1);
      if (error) {
        console.error("[resolveUsuarioErpFromAuthUser] email:", error.message);
        if (/invalid schema/i.test(error.message ?? "")) {
          postgrestSchemaUnavailable = true;
          break;
        }
        continue;
      }
      const r = rows?.[0] as UsuarioErpBasico | undefined;
      if (r) return r;
    }
  }

  // Fallback definitivo: ir al Postgres por el pool compartido, sin pasar por
  // PostgREST (necesario cuando el schema configurado no está expuesto).
  const viaPool = await resolveViaPgPool(user.id, emailsToTry);
  if (viaPool) return viaPool;

  return null;
}
