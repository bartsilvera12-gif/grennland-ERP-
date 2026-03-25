/**
 * Envío vía WhatsApp Cloud API (Graph)
 */
export type SendWhatsAppTextParams = {
  toDigits: string;
  text: string;
  phoneNumberId: string;
  accessToken: string;
  graphVersion?: string;
};

export type SendWhatsAppTextResult =
  | { ok: true; waMessageId: string | null; raw: unknown }
  | { ok: false; error: string; status?: number; raw?: unknown };

export async function sendWhatsAppText(
  params: SendWhatsAppTextParams
): Promise<SendWhatsAppTextResult> {
  const v = params.graphVersion ?? process.env.WHATSAPP_GRAPH_VERSION ?? "v19.0";
  const url = `https://graph.facebook.com/${v}/${params.phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to: params.toDigits,
    type: "text",
    text: { body: params.text },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const errMsg =
      typeof raw.error === "object" && raw.error && "message" in (raw.error as object)
        ? String((raw.error as { message?: string }).message)
        : res.statusText;
    return {
      ok: false,
      error: errMsg || `HTTP ${res.status}`,
      status: res.status,
      raw,
    };
  }

  const messages = raw.messages as Array<{ id?: string }> | undefined;
  const waMessageId = messages?.[0]?.id ?? null;

  return { ok: true, waMessageId, raw };
}
