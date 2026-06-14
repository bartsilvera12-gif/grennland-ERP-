-- =============================================================================
-- AlquiloYa · Fotos de perfil (avatares)
--
-- 1) Bucket público `avatars` en Storage para fotos de perfil de:
--    - agentes/publicadores (URL en alquiloya.agentes.foto_url, ya existente)
--    - usuarios internos del ERP (nueva columna alquiloya.usuarios.avatar_url)
-- 2) Columna nullable alquiloya.usuarios.avatar_url para el avatar del header.
--
-- Idempotente (IF NOT EXISTS / ON CONFLICT). El bucket también se crea de forma
-- lazy desde el código (src/lib/alquiloya/avatar-storage.ts) por si esta
-- migración no se aplicó en algún entorno.
-- =============================================================================

-- 1) Bucket público de avatares (4 MB, solo imágenes).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  4194304,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Avatar opcional para usuarios internos del ERP.
ALTER TABLE alquiloya.usuarios
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN alquiloya.usuarios.avatar_url IS
  'URL pública de la foto de perfil del usuario (bucket Storage `avatars`). Nullable: si es NULL el header usa la inicial del nombre/email.';

-- Refrescar el cache de esquema de PostgREST para exponer la nueva columna.
SELECT pg_notify('pgrst', 'reload schema');
