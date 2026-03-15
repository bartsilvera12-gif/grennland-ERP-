/**
 * Sistema de eventos para integraciones externas.
 * Base para Webhooks y automatizaciones futuras.
 */

export const EVENT_TYPES = {
  cliente_creado: "cliente_creado",
  factura_creada: "factura_creada",
  pago_registrado: "pago_registrado",
  suscripcion_creada: "suscripcion_creada",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

/**
 * Emite un evento. Por ahora solo registra en consola.
 * En el futuro: disparar webhooks, colas, etc.
 */
export function emitEvent(eventName: EventType, payload: Record<string, unknown>): void {
  console.log(`[ERP Event] ${eventName}`, payload);
}
