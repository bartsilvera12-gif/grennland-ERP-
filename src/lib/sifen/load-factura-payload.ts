import type { AppSupabaseClient } from "@/lib/supabase/schema";
import {
  validateAndBuildSifenPayload,
  type BuildSifenPayloadInput,
} from "./build-payload";
import type { AmbienteSifen, SifenFacturaPayloadBase } from "./types";

export type LoadSifenPayloadFailure =
  | { status: 400; message: string }
  | { status: 404; message: string };

export type LoadSifenPayloadResult =
  | { ok: true; payload: SifenFacturaPayloadBase; ambiente: AmbienteSifen }
  | { ok: false; error: LoadSifenPayloadFailure };

function ambienteDesdeConfigRow(raw: unknown): AmbienteSifen {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "produccion" ? "produccion" : "test";
}

/**
 * Carga factura, ítems, cliente, config SIFEN y borrador electrónico;
 * valida y devuelve el payload base ERP (sin eventos de auditoría).
 */
export async function loadValidatedSifenPayload(
  supabase: AppSupabaseClient,
  empresaId: string,
  facturaId: string
): Promise<LoadSifenPayloadResult> {
  const fid = facturaId.trim();

  // Pedimos tambien cliente_razon_social / cliente_ruc para el fallback:
  // si la factura no tiene cliente_id (caso facturas de servicios donde el
  // receptor se carga inline en la cabecera, no en la tabla clientes),
  // construimos un cliente sintetico para no romper el payload SIFEN.
  const { data: factura, error: errFactura } = await supabase
    .from("facturas")
    .select(
      "id, cliente_id, numero_factura, fecha, tipo, moneda, monto, saldo, cliente_razon_social, cliente_ruc"
    )
    .eq("id", fid)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (errFactura) {
    return { ok: false, error: { status: 400, message: errFactura.message } };
  }
  if (!factura) {
    return { ok: false, error: { status: 404, message: "Factura no encontrada" } };
  }

  const clienteId = (factura.cliente_id ?? null) as string | null;
  const facturaRazonSocial = (factura.cliente_razon_social ?? null) as string | null;
  const facturaRuc = (factura.cliente_ruc ?? null) as string | null;

  // Resolver el cliente:
  //   - Si la factura tiene cliente_id real → buscamos en alquiloya.clientes.
  //   - Si NO → construimos un cliente sintetico desde la cabecera.
  // El query a clientes con eq("id", null) producia el error
  //   invalid input syntax for type uuid: "null"
  // porque Supabase serializaba null como literal string.
  const clienteQuery =
    clienteId
      ? supabase
          .from("clientes")
          .select(
            "id, empresa, nombre_contacto, nombre, ruc, documento, direccion, telefono, email, pais, sifen_receptor_extranjero, sifen_codigo_pais, sifen_tipo_doc_receptor, sifen_receptor_manual, sifen_receptor_naturaleza, sifen_ti_ope, sifen_num_id_de, sifen_direccion_de, sifen_num_casa_de, sifen_descripcion_tipo_doc"
          )
          .eq("id", clienteId)
          .eq("empresa_id", empresaId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as { data: null; error: null });

  const [itemsRes, clienteRes, configRes, electronicaRes] = await Promise.all([
    supabase
      .from("factura_items")
      .select("descripcion, cantidad, precio_unitario, subtotal, iva, total")
      .eq("factura_id", fid)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: true }),
    clienteQuery,
    supabase
      .from("empresa_sifen_config")
      .select(
        "ruc, razon_social, direccion_fiscal, timbrado_numero, timbrado_fecha_inicio_vigencia, actividad_economica_codigo, actividad_economica_descripcion, establecimiento, punto_expedicion, csc, activo, ambiente"
      )
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    supabase
      .from("factura_electronica")
      .select("id, estado_sifen, sifen_regeneracion_seq")
      .eq("factura_id", fid)
      .eq("empresa_id", empresaId)
      .maybeSingle(),
  ]);

  if (itemsRes.error) {
    return { ok: false, error: { status: 400, message: itemsRes.error.message } };
  }
  if (clienteRes.error) {
    return { ok: false, error: { status: 400, message: clienteRes.error.message } };
  }
  if (configRes.error) {
    return { ok: false, error: { status: 400, message: configRes.error.message } };
  }
  if (electronicaRes.error) {
    return { ok: false, error: { status: 400, message: electronicaRes.error.message } };
  }

  // Cliente: si vino de la tabla, lo usamos directo. Si no (factura sin
  // cliente_id) sintetizamos desde la cabecera para que el receptor SIFEN
  // tenga al menos razon social + RUC, que es lo minimo que el form de
  // /ventas/nueva exige para crear la factura.
  const clienteResuelto: BuildSifenPayloadInput["cliente"] = clienteRes.data
    ? (clienteRes.data as BuildSifenPayloadInput["cliente"])
    : facturaRazonSocial || facturaRuc
      ? {
          id: "synthetic-from-factura",
          empresa: facturaRazonSocial,
          nombre_contacto: null,
          nombre: facturaRazonSocial,
          ruc: facturaRuc,
          documento: facturaRuc,
          direccion: null,
          telefono: null,
          email: null,
          pais: "Paraguay",
          sifen_receptor_extranjero: false,
          sifen_codigo_pais: null,
          sifen_tipo_doc_receptor: null,
          sifen_receptor_manual: false,
          sifen_receptor_naturaleza: null,
          sifen_ti_ope: null,
          sifen_num_id_de: null,
          sifen_direccion_de: null,
          sifen_num_casa_de: null,
          sifen_descripcion_tipo_doc: null,
        }
      : null;

  const buildInput: BuildSifenPayloadInput = {
    factura: {
      id: factura.id as string,
      // Si cliente_id es null en la fila real, propagamos null para que SIFEN
      // build use el cliente sintetico, en lugar de un cast forzado a string.
      cliente_id: (factura.cliente_id as string | null) ?? "",
      numero_factura: factura.numero_factura as string,
      fecha: factura.fecha as string,
      tipo: factura.tipo as string,
      moneda: factura.moneda as string,
      monto: factura.monto,
      saldo: factura.saldo,
    },
    items: (itemsRes.data ?? []) as BuildSifenPayloadInput["items"],
    cliente: clienteResuelto,
    config: configRes.data as BuildSifenPayloadInput["config"],
    facturaElectronica: electronicaRes.data as BuildSifenPayloadInput["facturaElectronica"],
  };

  const built = validateAndBuildSifenPayload(buildInput);
  if (!built.ok) {
    return { ok: false, error: { status: 400, message: built.error } };
  }

  return {
    ok: true,
    payload: built.payload,
    ambiente: ambienteDesdeConfigRow(configRes.data?.ambiente),
  };
}
