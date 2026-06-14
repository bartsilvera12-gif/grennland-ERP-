import "server-only";
import type { AppSupabaseClient } from "@/lib/supabase/schema";

/**
 * Almacenamiento de fotos de perfil (avatares) en Supabase Storage.
 *
 * Un único bucket público `avatars` para:
 *   - Agentes/publicadores AlquiloYa  → path `agentes/{empresa_id}/{agente_id}.{ext}`
 *     (la URL se guarda en `alquiloya.agentes.foto_url` y se muestra en la web pública).
 *   - Usuarios internos del ERP        → path `usuarios/{usuario_id}.{ext}`
 *     (la URL se guarda en `alquiloya.usuarios.avatar_url` y se muestra en el header).
 *
 * Bucket público (getPublicUrl) porque las fotos de agentes se muestran en la
 * web pública y no son datos sensibles. Se crea de forma idempotente (lazy)
 * igual que `chat-media`/`productos-imagenes`, así funciona aunque la migración
 * de bucket no se haya aplicado todavía.
 */
export const AVATARS_BUCKET = "avatars";

/** MIME aceptados para fotos de perfil. */
export const AVATAR_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Tamaño máximo: 4 MB (suficiente para un retrato, evita abusos). */
export const AVATAR_MAX_BYTES = 4 * 1024 * 1024;

let bucketEnsured = false;

/** Crea el bucket `avatars` si no existe (idempotente, cacheado en proceso). */
export async function ensureAvatarsBucket(supabase: AppSupabaseClient): Promise<void> {
  if (bucketEnsured) return;
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(error.message);
  const exists = (data ?? []).some((b) => b.name === AVATARS_BUCKET);
  if (!exists) {
    const { error: createErr } = await supabase.storage.createBucket(AVATARS_BUCKET, {
      public: true,
      fileSizeLimit: "4MB",
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (createErr && !createErr.message.toLowerCase().includes("already exists")) {
      throw new Error(createErr.message);
    }
  }
  bucketEnsured = true;
}

/** Extensión de archivo a partir del MIME validado. */
export function extForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? "jpg";
}

/**
 * Valida un `File` de avatar. Devuelve `{ ok: false, error, status }` o
 * `{ ok: true, mime, bytes }`.
 */
export async function readAvatarFile(
  file: unknown
): Promise<
  | { ok: false; error: string; status: number }
  | { ok: true; mime: string; bytes: Uint8Array }
> {
  if (!(file instanceof File)) {
    return { ok: false, error: "Archivo requerido", status: 400 };
  }
  const mime = (file.type || "").toLowerCase();
  if (!AVATAR_ALLOWED_MIME.has(mime)) {
    return { ok: false, error: "Solo se permiten imágenes JPG, PNG o WEBP", status: 400 };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "La imagen supera el máximo de 4 MB", status: 413 };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return { ok: false, error: "El archivo está vacío", status: 400 };
  }
  return { ok: true, mime, bytes };
}

/**
 * Sube los bytes al bucket `avatars`, sobreescribiendo (`upsert`) y devuelve
 * la URL pública con un cache-buster para que el navegador refresque la imagen.
 */
export async function uploadAvatar(
  supabase: AppSupabaseClient,
  objectPath: string,
  bytes: Uint8Array,
  mime: string
): Promise<string> {
  await ensureAvatarsBucket(supabase);
  const up = await supabase.storage.from(AVATARS_BUCKET).upload(objectPath, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (up.error) throw new Error(up.error.message);
  const publicUrl = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(objectPath).data.publicUrl;
  // cache-buster: la URL pública es estable (upsert) y el navegador la cachearía.
  return `${publicUrl}?v=${Date.now()}`;
}
