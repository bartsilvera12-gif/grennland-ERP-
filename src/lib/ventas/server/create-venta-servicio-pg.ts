import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import type { LineaServicio, MonedaVenta, TipoIvaVenta } from "@/lib/ventas/types";

export interface CreateVentaServicioParams {
  schema: string;
  empresaId: string;
  clienteRazonSocial: string;
  clienteRuc: string | null;
  moneda: MonedaVenta;
  tipoCambio: number;
  tipoIvaCabecera: TipoIvaVenta;
  servicios: LineaServicio[];
  /** Totales declarados por el cliente (se contrastan con el recálculo). */
  subtotalDeclarado: number;
  montoIvaDeclarado: number;
  totalDeclarado: number;
  observaciones: string | null;
}

const TOL = 2; // guaraníes — tolerancia de redondeo

let ventasServicioColumnsReady = false;

/**
 * Bootstrap idempotente: agrega columnas que necesita el modo "venta de
 * servicios" a la tabla `<schema>.ventas`. Soporta tablas que todavia tienen
 * el esquema viejo (solo productos) sin obligar a correr migrations.
 */
async function ensureVentasServicioColumns(
  pool: NonNullable<ReturnType<typeof getChatPostgresPool>>,
  schema: string,
): Promise<void> {
  if (ventasServicioColumnsReady) return;
  const tV = quoteSchemaTable(schema, "ventas");
  await pool.query(
    `ALTER TABLE ${tV}
       ADD COLUMN IF NOT EXISTS cliente_razon_social text,
       ADD COLUMN IF NOT EXISTS cliente_ruc          text,
       ADD COLUMN IF NOT EXISTS tipo_iva_cabecera    text,
       ADD COLUMN IF NOT EXISTS descripcion_servicios jsonb,
       ADD COLUMN IF NOT EXISTS observaciones       text`,
  );
  ventasServicioColumnsReady = true;
}

function ivaRate(tipo: TipoIvaVenta): number {
  if (tipo === "5%") return 0.05;
  if (tipo === "10%") return 0.10;
  return 0;
}

function recalcServicios(servicios: LineaServicio[], tipoIva: TipoIvaVenta) {
  let subtotal = 0;
  for (const s of servicios) subtotal += Number(s.monto) || 0;
  // El IVA se aplica sobre el subtotal total (cabecera). El subtotal queda neto.
  const rate = ivaRate(tipoIva);
  const montoIva = subtotal * rate;
  const total = subtotal + montoIva;
  return { subtotal, montoIva, total };
}

/**
 * Crea una venta en modo SERVICIOS. No toca productos ni stock — solo escribe
 * la cabecera con las nuevas columnas (razon_social, ruc, descripcion_servicios
 * en jsonb, tipo_iva_cabecera). Genera numero_control igual que la de productos.
 */
export async function createVentaServicioPg(
  params: CreateVentaServicioParams,
): Promise<{ ventaId: string; numeroControl: string; fechaIso: string }> {
  const pool = getChatPostgresPool();
  if (!pool) throw new Error("Sin conexión directa a Postgres (configura SUPABASE_DB_URL).");

  if (!params.clienteRazonSocial?.trim()) {
    throw new Error("La razón social es obligatoria.");
  }
  if (!params.servicios.length || params.servicios.every((s) => !s.descripcion?.trim() && !s.monto)) {
    throw new Error("Agregá al menos un servicio con descripción y monto.");
  }

  const validServicios = params.servicios
    .map((s) => ({ descripcion: (s.descripcion ?? "").trim(), monto: Number(s.monto) || 0 }))
    .filter((s) => s.descripcion && s.monto > 0);
  if (!validServicios.length) {
    throw new Error("Agregá al menos un servicio con descripción y monto > 0.");
  }

  const calc = recalcServicios(validServicios, params.tipoIvaCabecera);
  if (
    Math.abs(calc.subtotal - params.subtotalDeclarado) > TOL ||
    Math.abs(calc.montoIva - params.montoIvaDeclarado) > TOL ||
    Math.abs(calc.total - params.totalDeclarado) > TOL
  ) {
    throw new Error("Los totales no coinciden con los servicios cargados; revisalos.");
  }

  await ensureVentasServicioColumns(pool, params.schema);

  const tV = quoteSchemaTable(params.schema, "ventas");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const maxRow = await client.query<{ mx: string | null }>(
      `SELECT COALESCE(MAX(
         CASE
           WHEN numero_control ~ '^VTA-[0-9]+$'
           THEN substring(numero_control from '[0-9]+$')::bigint
           ELSE NULL::bigint
         END
       ), 0)::text AS mx
       FROM ${tV}
       WHERE empresa_id = $1`,
      [params.empresaId],
    );
    const nextNum = BigInt(maxRow.rows[0]?.mx ?? "0") + BigInt(1);
    const numeroControl = `VTA-${String(nextNum).padStart(6, "0")}`;
    const fechaIso = new Date().toISOString();

    const ins = await client.query<{ id: string }>(
      `INSERT INTO ${tV} (
         empresa_id, cliente_id, numero_control, moneda, tipo_cambio,
         subtotal, monto_iva, total, estado, tipo_venta, plazo_dias, fecha,
         observaciones, cliente_razon_social, cliente_ruc, tipo_iva_cabecera,
         descripcion_servicios
       ) VALUES (
         $1, NULL, $2, $3, $4,
         $5, $6, $7, 'completada', 'CONTADO', NULL, $8::timestamptz,
         $9, $10, $11, $12,
         $13::jsonb
       )
       RETURNING id`,
      [
        params.empresaId,
        numeroControl,
        params.moneda,
        params.tipoCambio,
        calc.subtotal,
        calc.montoIva,
        calc.total,
        fechaIso,
        params.observaciones,
        params.clienteRazonSocial.trim(),
        params.clienteRuc?.trim() || null,
        params.tipoIvaCabecera,
        JSON.stringify(validServicios),
      ],
    );

    await client.query("COMMIT");
    return { ventaId: ins.rows[0].id, numeroControl, fechaIso };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
