import type { User } from "@supabase/supabase-js";
import type { ModulosSupabase } from "@/lib/modulos/resolve-effective-modules";

export type UsuarioErpBasico = {
  id: string;
  empresa_id: string | null;
  rol: string | null;
};

function collectEmailVariants(email: string | null | undefined): string[] {
  const t = email?.trim().toLowerCase();
  if (!t) return [];
  const set = new Set<string>();
  set.add(t);
  set.add(t.replace(/neuratomations/g, "neurautomations"));
  set.add(t.replace(/neurautomations/g, "neuratomations"));
  return [...set];
}

/**
 * Resuelve la fila `zentra_erp.usuarios` para la sesión de Auth.
 * Prioridad: `auth_user_id` → emails (JWT + GoTrue admin por si el JWT viene incompleto) con variantes de typo.
 */
export async function resolveUsuarioErpFromAuthUser(
  supabase: ModulosSupabase,
  user: User | null
): Promise<UsuarioErpBasico | null> {
  if (!user?.id) return null;

  const { data: byAuth, error: errAuth } = await supabase
    .from("usuarios")
    .select("id, empresa_id, rol")
    .eq("auth_user_id", user.id)
    .limit(1);
  if (errAuth) {
    console.error("[resolveUsuarioErpFromAuthUser] auth_user_id:", errAuth.message);
  }
  const hitAuth = byAuth?.[0] as UsuarioErpBasico | undefined;
  if (hitAuth) return hitAuth;

  const emailsToTry = new Set<string>();
  for (const e of collectEmailVariants(user.email)) emailsToTry.add(e);

  if (typeof supabase.auth?.admin?.getUserById === "function") {
    try {
      const { data: adm, error: admErr } = await supabase.auth.admin.getUserById(user.id);
      if (admErr) {
        console.error("[resolveUsuarioErpFromAuthUser] admin.getUserById:", admErr.message);
      } else {
        for (const e of collectEmailVariants(adm?.user?.email)) emailsToTry.add(e);
      }
    } catch (e) {
      console.error("[resolveUsuarioErpFromAuthUser] admin:", e);
    }
  }

  for (const em of emailsToTry) {
    const { data: rows, error } = await supabase
      .from("usuarios")
      .select("id, empresa_id, rol")
      .ilike("email", em)
      .limit(1);
    if (error) {
      console.error("[resolveUsuarioErpFromAuthUser] email:", error.message);
      continue;
    }
    const r = rows?.[0] as UsuarioErpBasico | undefined;
    if (r) return r;
  }

  return null;
}
