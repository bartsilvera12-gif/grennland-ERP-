/**
 * Sistema de Webhooks para integraciones externas (n8n, Zapier, etc.).
 * Placeholder para implementación futura.
 */

import type { EventType } from "./events";

/**
 * Envía un webhook con el evento y payload.
 * Por ahora es un placeholder; en el futuro:
 * - Consultar tabla webhooks_config (URLs por empresa/evento)
 * - Hacer POST a cada URL registrada
 * - Retry con backoff en caso de fallo
 */
export async function sendWebhook(
  _event: EventType,
  _payload: Record<string, unknown>
): Promise<void> {
  // TODO: Implementar cuando exista tabla webhooks_config
  // await fetch(webhookUrl, { method: "POST", body: JSON.stringify(payload) });
}
