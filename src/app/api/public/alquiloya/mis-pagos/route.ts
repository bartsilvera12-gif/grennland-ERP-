import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { getClientSchema } from "@/lib/env/instance-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Consulta publica "Mis pagos": dado un documento (CI o RUC), devuelve las
 * facturas del cliente con su estado (pagado/pendiente/vencido) y saldo.
 *
 * - Sin auth (la pagina solo pide CI/RUC; opcion A elegida por el cliente).
 * - Schema dinamico via NEURA_CLIENT_SCHEMA (default `zentra_erp`).
 * - Match por `documento` OR `ruc`, case-insensitive, trim.
 * - Fase 1: sin calculo de mora/multa (devuelve `interes` y `multa` en 0).
 *   En la Fase 2 se agregan campos de config + calculo automatico.
 */

function clean(v: string | null): string {
  return (v ?? "").trim();
}

function normalizeDoc(v: string): string {
  // Quita espacios, guiones y puntos para hacer match robusto.
  return v.replace(/[\s.\-]/g, "");
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const documentoRaw = clean(url.searchParams.get("documento"));

  if (documentoRaw.length < 3 || documentoRaw.length > 30) {
    return NextResponse.json(
      errorResponse("Documento invalido (3-30 caracteres)"),
      { status: 400 },
    );
  }

  const documentoNorm = normalizeDoc(documentoRaw);
  if (!/^[A-Za-z0-9]+$/.test(documentoNorm)) {
    return NextResponse.json(
      errorResponse("Documento solo admite letras y numeros"),
      { status: 400 },
    );
  }

  const pool = getChatPostgresPool();
  if (!pool) {
    return NextResponse.json(
      errorResponse("Base de datos no disponible"),
      { status: 503 },
    );
  }

  const schema = getClientSchema();
  // Identificador entre comillas dobles — getClientSchema viene del env, lo
  // sanitizamos defensivamente igual.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    return NextResponse.json(
      errorResponse("Schema invalido"),
      { status: 500 },
    );
  }

  try {
    // 1) Buscar cliente(s) por documento o ruc.
    //    Normalizamos en SQL con regexp_replace para que el match ignore
    //    guiones/puntos/espacios que el usuario pueda haber puesto.
    const clientesQ = `
      SELECT id, nombre_contacto, empresa, documento, ruc
      FROM "${schema}"."clientes"
      WHERE regexp_replace(COALESCE(documento, ''), '[\\s.\\-]', '', 'g') ILIKE $1
         OR regexp_replace(COALESCE(ruc, ''),       '[\\s.\\-]', '', 'g') ILIKE $1
      LIMIT 10
    `;
    const clientesRes = await queryWithRetry(pool, clientesQ, [documentoNorm]);
    const clientes = clientesRes.rows as Array<{
      id: string;
      nombre_contacto: string | null;
      empresa: string | null;
      documento: string | null;
      ruc: string | null;
    }>;

    if (clientes.length === 0) {
      return NextResponse.json(
        successResponse({
          encontrado: false,
          cliente: null,
          facturas: [],
          resumen: { saldo_total: 0, pendientes: 0, vencidas: 0, pagadas: 0 },
        }),
      );
    }

    const clienteIds = clientes.map((c) => c.id);

    // 2) Traer facturas de esos clientes.
    const facturasQ = `
      SELECT id, cliente_id, numero_factura, fecha, fecha_vencimiento,
             monto, saldo, estado, tipo, moneda
      FROM "${schema}"."facturas"
      WHERE cliente_id = ANY($1::uuid[])
      ORDER BY fecha_vencimiento ASC, fecha ASC
    `;
    const facturasRes = await queryWithRetry(pool, facturasQ, [clienteIds]);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const facturas = (facturasRes.rows as Array<{
      id: string;
      cliente_id: string;
      numero_factura: string;
      fecha: string;
      fecha_vencimiento: string;
      monto: string | number;
      saldo: string | number;
      estado: string;
      tipo: string;
      moneda: string;
    }>).map((f) => {
      const saldoNum = Number(f.saldo) || 0;
      const venc = new Date(f.fecha_vencimiento);
      const diasVencido =
        saldoNum > 0 && venc < hoy
          ? Math.floor((hoy.getTime() - venc.getTime()) / 86_400_000)
          : 0;
      const estadoCalc =
        saldoNum === 0
          ? "pagado"
          : diasVencido > 0
            ? "vencido"
            : "pendiente";
      return {
        id: f.id,
        cliente_id: f.cliente_id,
        numero: f.numero_factura,
        fecha_emision: f.fecha,
        fecha_vencimiento: f.fecha_vencimiento,
        monto: Number(f.monto) || 0,
        saldo: saldoNum,
        moneda: f.moneda,
        tipo: f.tipo,
        estado: estadoCalc,
        dias_vencido: diasVencido,
        // Fase 1: sin mora/multa todavia. La Fase 2 los calcula segun config.
        interes: 0,
        multa: 0,
        total_actualizado: saldoNum,
      };
    });

    const resumen = facturas.reduce(
      (acc, f) => {
        acc.saldo_total += f.saldo;
        if (f.estado === "pagado") acc.pagadas += 1;
        else if (f.estado === "vencido") acc.vencidas += 1;
        else acc.pendientes += 1;
        return acc;
      },
      { saldo_total: 0, pendientes: 0, vencidas: 0, pagadas: 0 },
    );

    // Devolvemos info minima del cliente (no telefono/email — privacidad).
    const c0 = clientes[0];
    const clienteMin = {
      nombre: c0.nombre_contacto || c0.empresa || "Cliente",
      documento: c0.documento,
      ruc: c0.ruc,
    };

    return NextResponse.json(
      successResponse({
        encontrado: true,
        cliente: clienteMin,
        facturas,
        resumen,
      }),
    );
  } catch (err) {
    console.error("[mis-pagos] error:", err);
    return NextResponse.json(
      errorResponse("Error consultando pagos"),
      { status: 500 },
    );
  }
}
