/**
 * Clasificación mutuamente excluyente Inbox vs pestaña Bot (omnicanal).
 *
 * - Bot: automatización vigente (sesión de flujo activa coherente, flujo publicado activo).
 * - Inbox: todo lo demás abierto/pendiente (humano, sin bot, sin flujo, sesión inválida, etc.).
 */

export type FlowSessionRowMin = {
  id: string;
  status: string;
  flow_code: string;
  conversation_id: string;
};

export function buildFlowSessionMap(rows: FlowSessionRowMin[] | null | undefined): Map<string, FlowSessionRowMin> {
  const m = new Map<string, FlowSessionRowMin>();
  for (const r of rows ?? []) {
    const id = String(r.id ?? "").trim();
    if (!id) continue;
    m.set(id, {
      id,
      status: String(r.status ?? "").trim(),
      flow_code: String(r.flow_code ?? "").trim(),
      conversation_id: String(r.conversation_id ?? "").trim(),
    });
  }
  return m;
}

function debugForceNoBotTab(): boolean {
  return String(process.env.CHAT_BOT_IF_TRUE_RETURN_FALSE ?? "")
    .trim()
    .toLowerCase() === "true";
}

export type InboxBotClassificationInput = {
  activeFlowCodeSet: Set<string>;
  sessionById: Map<string, FlowSessionRowMin>;
};

/**
 * `true` si la conversación debe listarse solo en la pestaña **Bot** (no en Inbox).
 * Requiere evidencia fuerte de sesión activa; si hay duda → Inbox.
 */
export function conversationBelongsToBotTab(
  conv: Record<string, unknown>,
  ctx: InboxBotClassificationInput
): boolean {
  if (debugForceNoBotTab()) return false;

  const status = String(conv.status ?? "").trim().toLowerCase();
  if (status !== "open" && status !== "pending") return false;

  if (Boolean(conv.human_taken_over)) return false;

  const flowStatus = String(conv.flow_status ?? "").trim().toLowerCase();
  if (flowStatus === "human") return false;

  if (ctx.activeFlowCodeSet.size === 0) return false;

  const conversationId = String(conv.id ?? "").trim();
  if (!conversationId) return false;

  const sessionId = String(conv.active_flow_session_id ?? "").trim();
  if (!sessionId) return false;

  const sess = ctx.sessionById.get(sessionId);
  if (!sess) return false;
  if (String(sess.status ?? "").trim() !== "active") return false;
  if (String(sess.conversation_id ?? "").trim() !== conversationId) return false;

  const sessFlow = String(sess.flow_code ?? "").trim();
  const convFlow = String(conv.flow_code ?? "").trim();

  /** La sesión es la fuente de verdad del flujo en ejecución; la fila conv a veces viene desfasada. */
  const runningFlow = sessFlow || convFlow;
  if (!runningFlow || !ctx.activeFlowCodeSet.has(runningFlow)) return false;

  return true;
}

export function conversationBelongsToInboxTab(
  conv: Record<string, unknown>,
  ctx: InboxBotClassificationInput
): boolean {
  const status = String(conv.status ?? "").trim().toLowerCase();
  if (status !== "open" && status !== "pending") return false;
  return !conversationBelongsToBotTab(conv, ctx);
}
