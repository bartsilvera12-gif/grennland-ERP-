import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * POST /api/productos
 *
 * Alta server-side de producto. Resuelve empresa/schema via tenant-api
 * (evita consultar usuarios desde el browser y RLS de zentra_erp.usuarios).
 * Si stock_actual > 0, registra movimiento de inventario_inicial atomicamente
 * en el mismo handler.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) {
      return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    }
    const { supabase, auth } = ctx;
    const empresaId = auth.empresa_id;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(errorResponse("JSON inválido."), { status: 400 });
    }

    const nombre = String(body.nombre ?? "").trim();
    const sku = String(body.sku ?? "").trim();
    if (!nombre) return NextResponse.json(errorResponse("El nombre es obligatorio."), { status: 400 });
    if (!sku) return NextResponse.json(errorResponse("El SKU es obligatorio."), { status: 400 });

    const insert: Record<string, unknown> = {
      empresa_id: empresaId,
      nombre,
      sku,
      costo_promedio: Number(body.costo_promedio ?? 0) || 0,
      precio_venta: Number(body.precio_venta ?? 0) || 0,
      stock_actual: Number(body.stock_actual ?? 0) || 0,
      stock_minimo: Number(body.stock_minimo ?? 0) || 0,
      unidad_medida: String(body.unidad_medida ?? "Unidad").trim() || "Unidad",
      metodo_valuacion:
        body.metodo_valuacion === "FIFO" || body.metodo_valuacion === "LIFO"
          ? body.metodo_valuacion
          : "CPP",
    };

    const codigoBarras = body.codigo_barras != null ? String(body.codigo_barras).trim() : "";
    if (codigoBarras) {
      insert.codigo_barras = codigoBarras;
      insert.codigo_barras_interno = body.codigo_barras_interno === true;
    }

    const { data, error } = await supabase
      .from("productos")
      .insert([insert])
      .select()
      .single();

    if (error) {
      const code = (error as { code?: string }).code;
      const msg = error.message ?? "";
      if (code === "23505" && /codigo_barras/i.test(msg)) {
        return NextResponse.json(
          errorResponse("Ya existe otro producto con el mismo código de barras en esta empresa."),
          { status: 409 }
        );
      }
      if (code === "23505" && /sku/i.test(msg)) {
        return NextResponse.json(
          errorResponse("Ya existe otro producto con el mismo SKU en esta empresa."),
          { status: 409 }
        );
      }
      if (code === "23505") {
        return NextResponse.json(
          errorResponse("Ya existe un registro con un valor único conflictivo."),
          { status: 409 }
        );
      }
      return NextResponse.json(errorResponse(msg || "No se pudo guardar el producto."), { status: 500 });
    }

    const producto = data as Record<string, unknown>;
    const productoId = producto.id as string;
    const stockInicial = Number(insert.stock_actual);
    const costoInicial = Number(insert.costo_promedio);

    // Movimiento inventario_inicial (server-side, mismo contexto tenant)
    if (stockInicial > 0) {
      const movInsert = {
        empresa_id: empresaId,
        producto_id: productoId,
        producto_nombre: nombre,
        producto_sku: sku,
        tipo: "ENTRADA",
        cantidad: stockInicial,
        costo_unitario: costoInicial,
        origen: "inventario_inicial",
        referencia: null,
        fecha: new Date().toISOString(),
      };
      const { error: movErr } = await supabase.from("movimientos_inventario").insert([movInsert]);
      if (movErr) {
        // No revertimos el producto: dejamos el alta, solo logueamos.
        console.error("[/api/productos] inventario_inicial:", movErr.message);
      }
    }

    return NextResponse.json(successResponse({ producto }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
