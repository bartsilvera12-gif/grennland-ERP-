import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import type { Venta, LineaVenta, TipoIvaVenta } from "@/lib/ventas/types";

interface VentaRow {
  id: string;
  empresa_id: string;
  numero_control: string;
  moneda: string;
  tipo_cambio: number | string;
  subtotal: number | string;
  monto_iva: number | string;
  total: number | string;
  tipo_venta: string;
  plazo_dias: number | null;
  fecha: string;
  // Columnas del modo "servicios" — opcionales: tenants viejos que aun no
  // tienen estas columnas hacen fallback al SELECT minimo.
  cliente_razon_social?: string | null;
  cliente_ruc?: string | null;
  tipo_iva_cabecera?: string | null;
  factura_id?: string | null;
  descripcion_servicios?: unknown;
}

interface VentaItemRow {
  venta_id: string;
  producto_id: string;
  producto_nombre: string;
  sku: string;
  cantidad: number | string;
  precio_venta_original: number | string;
  precio_venta: number | string;
  tipo_iva: string;
  subtotal: number | string;
  monto_iva: number | string;
  total_linea: number | string;
}

function num(v: number | string): number {
  return typeof v === "number" ? v : Number(v);
}

function mapItems(rows: VentaItemRow[]): LineaVenta[] {
  return rows.map((r) => ({
    producto_id: r.producto_id,
    producto_nombre: r.producto_nombre,
    sku: r.sku,
    cantidad: num(r.cantidad),
    precio_venta_original: num(r.precio_venta_original),
    precio_venta: num(r.precio_venta),
    tipo_iva: r.tipo_iva as TipoIvaVenta,
    subtotal: num(r.subtotal),
    monto_iva: num(r.monto_iva),
    total_linea: num(r.total_linea),
  }));
}

/**
 * GET /api/ventas — listado via PG directo (soporta tenants erp_* no
 * expuestos por PostgREST).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;
    const schema = assertAllowedChatDataSchema(await fetchDataSchemaForEmpresaId(empresaId));
    const pool = getChatPostgresPool();
    if (!pool) return NextResponse.json(errorResponse("Pool no disponible."), { status: 500 });

    const tV = quoteSchemaTable(schema, "ventas");
    const tI = quoteSchemaTable(schema, "ventas_items");

    // Serializado (no Promise.all) para no agotar el pool session-mode (limite 15).
    // SELECT con columnas nuevas (modo servicios). Si falla porque el tenant
    // todavia no tiene esas columnas, reintentamos sin ellas — asi seguimos
    // mostrando las ventas viejas hasta que alguien cree una nueva (el POST
    // de servicio bootstrapea las columnas).
    let ventasQ;
    try {
      ventasQ = await queryWithRetry<VentaRow>(pool,
        `SELECT id, empresa_id, numero_control, moneda, tipo_cambio, subtotal, monto_iva,
                total, tipo_venta, plazo_dias, fecha,
                cliente_razon_social, cliente_ruc, tipo_iva_cabecera, descripcion_servicios,
                factura_id
           FROM ${tV} WHERE empresa_id = $1::uuid
          ORDER BY fecha DESC LIMIT 500`,
        [empresaId]
      );
    } catch {
      ventasQ = await queryWithRetry<VentaRow>(pool,
        `SELECT id, empresa_id, numero_control, moneda, tipo_cambio, subtotal, monto_iva,
                total, tipo_venta, plazo_dias, fecha
           FROM ${tV} WHERE empresa_id = $1::uuid
          ORDER BY fecha DESC LIMIT 500`,
        [empresaId]
      );
    }
    const itemsQ = await queryWithRetry<VentaItemRow>(pool,
      `SELECT venta_id, producto_id, producto_nombre, sku, cantidad,
              precio_venta_original, precio_venta, tipo_iva, subtotal, monto_iva, total_linea
         FROM ${tI} WHERE empresa_id = $1::uuid`,
      [empresaId]
    );

    const byVenta = new Map<string, VentaItemRow[]>();
    for (const row of itemsQ.rows) {
      const list = byVenta.get(row.venta_id) ?? [];
      list.push(row);
      byVenta.set(row.venta_id, list);
    }

    const ventas: Venta[] = ventasQ.rows.map((r) => {
      const lineRows = byVenta.get(r.id) ?? [];
      const tipoIvaCab = r.tipo_iva_cabecera;
      const tipoIvaCabValid: TipoIvaVenta | null =
        tipoIvaCab === "EXENTA" || tipoIvaCab === "5%" || tipoIvaCab === "10%" ? tipoIvaCab : null;
      let serviciosArr: { descripcion: string; monto: number }[] | undefined;
      const desc = r.descripcion_servicios;
      if (Array.isArray(desc)) {
        serviciosArr = desc
          .map((x) => {
            if (!x || typeof x !== "object") return null;
            const o = x as Record<string, unknown>;
            const d = String(o.descripcion ?? "");
            const m = Number(o.monto);
            if (!d || !Number.isFinite(m)) return null;
            return { descripcion: d, monto: m };
          })
          .filter((y): y is { descripcion: string; monto: number } => y !== null);
      }
      return {
        id: r.id,
        numero_control: r.numero_control,
        items: mapItems(lineRows),
        servicios: serviciosArr,
        cliente_razon_social: r.cliente_razon_social ?? null,
        cliente_ruc: r.cliente_ruc ?? null,
        tipo_iva_cabecera: tipoIvaCabValid,
        moneda: r.moneda === "USD" ? "USD" : "GS",
        tipo_cambio: num(r.tipo_cambio),
        subtotal: num(r.subtotal),
        monto_iva: num(r.monto_iva),
        total: num(r.total),
        tipo_venta: r.tipo_venta === "CREDITO" ? "CREDITO" : "CONTADO",
        plazo_dias: r.plazo_dias ?? undefined,
        fecha: r.fecha,
        factura_id: r.factura_id ?? null,
      };
    });

    return NextResponse.json(successResponse({ ventas }));
  } catch (err) {
    console.error("[/api/ventas GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar las ventas."), { status: 500 });
  }
}
