-- =============================================================================
-- AlquiloYa · Bucket de avatares (fotos de perfil de agentes)
--
-- Bucket público `avatars` en Storage para la foto de perfil que el agente
-- sube desde su panel web (/publico#admin-agent → "Mi perfil"). La URL se
-- guarda en alquiloya.agentes.foto_url (columna ya existente) y se muestra en
-- la web pública (cards y perfil del agente).
--
-- Idempotente (ON CONFLICT). El bucket también se crea de forma lazy desde el
-- código (src/lib/alquiloya/avatar-storage.ts) por si esta migración no se
-- aplicó en algún entorno.
-- =============================================================================

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
