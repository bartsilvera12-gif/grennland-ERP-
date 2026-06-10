import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión Supabase en cookies antes de Route Handlers / RSC.
 * Solo NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (sin db.schema en getUser).
 */
/**
 * Lista de hosts considerados "web pública AlquiloYa" (env-driven, sin hardcode).
 * Formato: coma-separados, ej. "alquiloya.com.py,www.alquiloya.com.py".
 */
function getPublicHosts(): string[] {
  const raw = process.env.NEURA_PUBLIC_HOSTS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
}

/** Hostname normalizado del request (sin puerto, lowercase). */
function getRequestHostname(request: NextRequest): string {
  const hostHeader = request.headers.get("host") ?? "";
  return hostHeader.split(":")[0].trim().toLowerCase();
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicHosts = getPublicHosts();

  // Host-aware: si el request viene de un dominio público configurado y apunta a la raíz,
  // se reescribe a la web legacy estática. Solo afecta "/" (no /api, /_next, /dashboard, etc.).
  // IMPORTANTE: antes hacíamos `return rewrite` directo aquí y eso SKIPPEABA el refresh de
  // la sesión Supabase para todos los visitantes del sitio público. Resultado: si el
  // access_token (1h TTL) expiraba entre visitas, el usuario aparecía deslogueado al
  // volver y el muro de "Necesitás cuenta activa" saltaba aunque hubiera refresh_token
  // valido en la cookie. Ahora preparamos la respuesta de rewrite y dejamos que la
  // siguiente seccion (auth refresh) escriba cookies sobre ella.
  let supabaseResponse: NextResponse;
  if (
    publicHosts.length > 0 &&
    (pathname === "/" || pathname === "") &&
    publicHosts.includes(getRequestHostname(request))
  ) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/alquiloya-legacy/index.html";
    supabaseResponse = NextResponse.rewrite(rewriteUrl);
  } else {
    supabaseResponse = NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // Re-armar la respuesta: si veniamos del path del rewrite, mantenemos el rewrite.
        if (
          publicHosts.length > 0 &&
          (pathname === "/" || pathname === "") &&
          publicHosts.includes(getRequestHostname(request))
        ) {
          const rw = request.nextUrl.clone();
          rw.pathname = "/alquiloya-legacy/index.html";
          supabaseResponse = NextResponse.rewrite(rw);
        } else {
          supabaseResponse = NextResponse.next({ request });
        }
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  return supabaseResponse;
}

/**
 * Excluir `/api/webhooks/*`: Meta hace GET sin cookies para verificar el webhook;
 * no debe pasar por refresh de sesión Supabase (y queda listo para proxies estrictos).
 */
export const config = {
  matcher: [
    "/((?!api/webhooks|_next/static|_next/image|favicon.ico|alquiloya-legacy/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
