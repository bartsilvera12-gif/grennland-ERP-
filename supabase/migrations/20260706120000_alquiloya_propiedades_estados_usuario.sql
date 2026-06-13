-- =============================================================================
-- AlquiloYa · agrega estados 'activa', 'alquilada', 'reservada' al CHECK
-- de alquiloya.propiedades.
--
-- Motivo: el selector "Estado" del panel del dueño (admin.jsx) ofrece
-- Activa/Pausada/Alquilada/Reservada y el endpoint PATCH valida contra
-- ESTADOS_USUARIO_OK = {pausada, activa, alquilada, reservada}. Pero el
-- CHECK constraint solo aceptaba la forma masculina del verbo
-- ('alquilado', 'reservado') o no aceptaba 'activa', asi que el UPDATE
-- explotaba a nivel DB y el usuario veia "no se pudo cambiar el estado".
--
-- Solucion: aceptamos AMBAS formas (los nombres viejos siguen funcionando
-- para no romper filas existentes; los nuevos cubren lo que la UI manda).
--
-- Idempotente: dropea el CHECK si existe y lo recrea con la lista nueva.
-- =============================================================================

DO $$
BEGIN
  PERFORM 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'alquiloya'
     AND t.relname = 'propiedades'
     AND c.conname = 'propiedades_estado_check';
  IF FOUND THEN
    EXECUTE 'ALTER TABLE alquiloya.propiedades DROP CONSTRAINT propiedades_estado_check';
  END IF;
END $$;

ALTER TABLE alquiloya.propiedades
  ADD CONSTRAINT propiedades_estado_check
  CHECK (
    estado IS NULL OR estado IN (
      'disponible',
      'activa',
      'reservado','reservada',
      'alquilado','alquilada',
      'vendido','vendida',
      'pausada',
      'inactiva',
      'rechazada',
      'cerrado','cerrada',
      'finalizado','finalizada',
      'eliminada'
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
