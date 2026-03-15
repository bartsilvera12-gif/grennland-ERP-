import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export interface UsuarioConEmpresa {
  user: User;
  empresa_id: string;
}

/**
 * Obtiene el usuario autenticado y su empresa_id.
 * Requerido para todas las rutas API multiempresa.
 *
 * @returns { user, empresa_id } o null si no autenticado / sin empresa
 */
export async function getUserAndEmpresa(): Promise<UsuarioConEmpresa | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return null;
  }

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.email) {
    return null;
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("empresa_id")
    .eq("email", user.email)
    .single();

  if (error || !usuario?.empresa_id) {
    return null;
  }

  return {
    user,
    empresa_id: usuario.empresa_id,
  };
}
