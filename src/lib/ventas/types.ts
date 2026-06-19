export type TipoIvaVenta = "EXENTA" | "5%" | "10%";
export type TipoVenta   = "CONTADO" | "CREDITO";
export type MonedaVenta = "GS" | "USD";

/** Un ítem dentro de una venta de productos (legacy). */
export interface LineaVenta {
  producto_id:           string;
  producto_nombre:       string;
  sku:                   string;
  cantidad:              number;
  precio_venta_original: number;  // en la moneda elegida
  precio_venta:          number;  // siempre en GS
  tipo_iva:              TipoIvaVenta;
  subtotal:              number;  // precio_venta × cantidad
  monto_iva:             number;
  total_linea:           number;  // subtotal + monto_iva
}

/** Item de venta de servicios (modelo nuevo): solo descripcion + monto. */
export interface LineaServicio {
  descripcion: string;
  monto:       number;
}

/**
 * Cabecera de venta. Soporta dos modalidades:
 *  - PRODUCTOS (legacy): `items` con productos + stock.
 *  - SERVICIOS (nuevo): `servicios` con descripcion+monto, cabecera con
 *    razón social, RUC y IVA global; sin productos ni stock.
 * Las propiedades nuevas son opcionales para no romper el modelo viejo.
 */
export interface Venta {
  /** UUID en base de datos. */
  id:             string;
  numero_control: string;   // VTA-000001, VTA-000002, …

  items: LineaVenta[];       // 1 o más productos (vacío en modo servicios)

  /** Modo servicios: lineas descripcion+monto. */
  servicios?: LineaServicio[];
  /** Modo servicios: razón social del cliente. */
  cliente_razon_social?: string | null;
  /** Modo servicios: RUC del cliente. */
  cliente_ruc?: string | null;
  /** Modo servicios: IVA aplicado a la cabecera (no por item). */
  tipo_iva_cabecera?: TipoIvaVenta | null;

  moneda:      MonedaVenta;
  tipo_cambio: number;       // 1 si moneda === "GS"

  subtotal:  number;         // Σ subtotal de ítems / Σ monto de servicios
  monto_iva: number;
  total:     number;

  tipo_venta: TipoVenta;     // siempre CONTADO en el modo nuevo
  plazo_dias?: number;       // solo si tipo_venta === "CREDITO"

  factura_id?: string | null;     // Si la venta tiene factura electronica, su UUID
  fecha: string;             // ISO string
}
