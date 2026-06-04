/**
 * cachedSessionFetch — wrapper sobre fetchWithSupabaseSession con:
 *   1. Cache en sessionStorage (por tab, no persiste cross-tab/login).
 *   2. Dedup en vuelo: si dos componentes piden la misma URL al mismo tiempo,
 *      reusan la misma Promise (no se duplican network calls).
 *
 * Sólo para GETs idempotentes. Si pasás opts.method != GET, hace bypass.
 */
import { fetchWithSupabaseSession } from "./fetch-with-supabase-session";

const inFlight = new Map<string, Promise<Response>>();

const STORAGE_PREFIX = "ays_cache_v1:"; // bumpear si cambiamos el shape

function storageKey(url: string): string {
  return STORAGE_PREFIX + url;
}

function safeRead<T>(url: string, ttlMs: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; data: T };
    if (Date.now() - parsed.t > ttlMs) {
      window.sessionStorage.removeItem(storageKey(url));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function safeWrite<T>(url: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      storageKey(url),
      JSON.stringify({ t: Date.now(), data })
    );
  } catch {
    /* sessionStorage lleno o bloqueado */
  }
}

/**
 * Limpia el cache de una URL específica o todo el cache (sin args).
 * Usar después de mutaciones que invaliden datos cacheados (POST/PATCH/DELETE).
 */
export function invalidateCachedFetch(url?: string): void {
  if (typeof window === "undefined") return;
  if (url) {
    window.sessionStorage.removeItem(storageKey(url));
    return;
  }
  for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
    const k = window.sessionStorage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) window.sessionStorage.removeItem(k);
  }
}

/**
 * Fetch GET con caché por sesión + dedupe en vuelo.
 *
 * @param url URL absoluta o relativa
 * @param ttlMs Cuánto vive el cache. Default 5 min. 0 = sin cache (solo dedup).
 * @returns El JSON parseado tipado.
 *
 * Comportamiento:
 *   1) Si hay cache válido en sessionStorage → lo devuelve sin pegar a la red.
 *   2) Si ya hay un fetch en vuelo para esta URL → comparte esa Promise.
 *   3) Si no, hace el fetch real, guarda en cache y devuelve.
 */
export async function cachedSessionFetch<T = unknown>(
  url: string,
  ttlMs: number = 5 * 60 * 1000
): Promise<T> {
  // 1) Hit de cache
  if (ttlMs > 0) {
    const cached = safeRead<T>(url, ttlMs);
    if (cached !== null) return cached;
  }

  // 2) Dedup en vuelo
  const existing = inFlight.get(url);
  if (existing) {
    const res = await existing.then((r) => r.clone());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as T;
    if (ttlMs > 0) safeWrite(url, data);
    return data;
  }

  // 3) Fetch real
  const p = fetchWithSupabaseSession(url, { cache: "no-store" });
  inFlight.set(url, p);
  try {
    const res = (await p).clone();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as T;
    if (ttlMs > 0) safeWrite(url, data);
    return data;
  } finally {
    // Solo borramos del inFlight cuando termina (sin importar éxito/fallo).
    // Pequeño grace period para que dedupers casi-simultáneos reciban la misma promise.
    setTimeout(() => inFlight.delete(url), 50);
  }
}
