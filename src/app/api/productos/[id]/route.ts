import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * PATCH /api/productos/[id]
 *
 * Actualizacion parcial server-side. Resuelve empresa/schema via tenant-api
 * (evita consultar usuarios desde el browser). Solo aplica los campos que
 * vienen en el body (semantica de patch).
 */
export async function PATCH(
  request: NextRequest,
  ctxParams: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctxParams.params;
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

    // Verificar ownership
    const prodRes = await supabase
      .from("productos")
      .select("id, empresa_id")
      .eq("id", id)
      .maybeSingle();
    const prod = prodRes.data as { id: string; empresa_id: string } | null;
    if (!prod || prod.empresa_id !== empresaId) {
      return NextResponse.json(errorResponse(API_ERRORS.NOT_FOUND), { status: 404 });
    }

    const patch: Record<string, unknown> = {};
    if (body.nombre !== undefined) patch.nombre = String(body.nombre).trim();
    if (body.sku !== undefined) patch.sku = String(body.sku).trim();
    if (body.costo_promedio !== undefined) patch.costo_promedio = Number(body.costo_promedio) || 0;
    if (body.precio_venta !== undefined) patch.precio_venta = Number(body.precio_venta) || 0;
    if (body.stock_actual !== undefined) patch.stock_actual = Number(body.stock_actual) || 0;
    if (body.stock_minimo !== undefined) patch.stock_minimo = Number(body.stock_minimo) || 0;
    if (body.unidad_medida !== undefined) patch.unidad_medida = String(body.unidad_medida).trim() || "Unidad";
    if (body.metodo_valuacion !== undefined) {
      const mv = body.metodo_valuacion;
      patch.metodo_valuacion = mv === "FIFO" || mv === "LIFO" ? mv : "CPP";
    }
    if (body.codigo_barras !== undefined) {
      const cb = body.codigo_barras != null ? String(body.codigo_barras).trim() : "";
      patch.codigo_barras = cb || null;
      if (body.codigo_barras_interno !== undefined) {
        patch.codigo_barras_interno = body.codigo_barras_interno === true;
      } else if (!cb) {
        patch.codigo_barras_interno = false;
      }
    }
    if (body.imagen_path !== undefined) {
      const v = body.imagen_path != null ? String(body.imagen_path) : "";
      patch.imagen_path = v || null;
    }
    if (body.imagen_url !== undefined) {
      const v = body.imagen_url != null ? String(body.imagen_url) : "";
      patch.imagen_url = v || null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(errorResponse("Sin campos para actualizar."), { status: 400 });
    }

    const { data, error } = await supabase
      .from("productos")
      .update(patch)
      .eq("id", id)
      .eq("empresa_id", empresaId)
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
      return NextResponse.json(errorResponse(msg || "No se pudo actualizar el producto."), { status: 500 });
    }

    return NextResponse.json(successResponse({ producto: data }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
