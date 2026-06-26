-- Agrega columna image_url a greenland.planes_publicacion.
-- La columna es opcional; cada plan puede tener su propia imagen que se
-- muestra en la web publica (sino, el sitio usa una imagen por defecto).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'greenland' AND table_name = 'planes_publicacion'
  ) THEN
    ALTER TABLE greenland.planes_publicacion
      ADD COLUMN IF NOT EXISTS image_url text;
  END IF;
END $$;
