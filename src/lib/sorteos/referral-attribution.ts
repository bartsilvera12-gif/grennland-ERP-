import type { SupabaseAdmin } from "@/lib/chat/types";
import { extractReferralTokenFromInboundText } from "@/lib/sorteos/referral-inbound-text";

const LOG = "[sorteo-referral]" as const;

export type ApplyReferralParams = {
  supabase: SupabaseAdmin;
  empresaId: string;
  conversationId: string;
  activeFlowSessionId: string | null | undefined;
  flowCode: string | null | undefined;
  inboundText: string;
  contactPhoneDigits: string;
};

/**
 * Atribuye revendedor a la sesión de flujo activa (no pisa si la sesión ya tiene revendedor).
 * 1) Canje de token (sorteo_revendedor_clicks) — fuente robusta post-click /r
 * 2) Código legible en sorteo_revendedores — respaldo / auditoría
 */
export async function applySorteoReferralToActiveSession(
  params: ApplyReferralParams
): Promise<void> {
  const sid = params.activeFlowSessionId?.trim();
  const fc = params.flowCode?.trim();
  if (!sid || !fc) return;

  const tokenRaw = extractReferralTokenFromInboundText(params.inboundText);
  if (!tokenRaw) return;

  const { data: sessionRow, error: sErr } = await params.supabase
    .from("chat_flow_sessions")
    .select("id, revendedor_id, empresa_id, conversation_id")
    .eq("id", sid)
    .eq("empresa_id", params.empresaId)
    .maybeSingle();

  if (sErr || !sessionRow) {
    console.warn(LOG, "session_load_failed", sErr?.message);
    return;
  }

  if ((sessionRow as { revendedor_id?: string | null }).revendedor_id) {
    return;
  }

  const convIdFromSession = (sessionRow as { conversation_id?: string }).conversation_id;
  if (convIdFromSession !== params.conversationId) {
    console.warn(LOG, "session_conversation_mismatch", { sid, conversationId: params.conversationId });
    return;
  }

  const { data: flowRow } = await params.supabase
    .from("chat_flows")
    .select("sorteo_id")
    .eq("empresa_id", params.empresaId)
    .eq("flow_code", fc)
    .maybeSingle();

  const sorteoId = (flowRow as { sorteo_id?: string | null } | null)?.sorteo_id?.trim() ?? null;
  if (!sorteoId) {
    return;
  }

  const nowIso = new Date().toISOString();

  const { data: clickRow } = await params.supabase
    .from("sorteo_revendedor_clicks")
    .select("id, revendedor_id, sorteo_id, empresa_id, redeemed_at, expires_at")
    .eq("attribution_token", tokenRaw)
    .eq("empresa_id", params.empresaId)
    .maybeSingle();

  const click = clickRow as
    | {
        id: string;
        revendedor_id: string;
        sorteo_id: string;
        redeemed_at: string | null;
        expires_at: string;
      }
    | null;

  if (
    click &&
    !click.redeemed_at &&
    click.sorteo_id === sorteoId &&
    new Date(click.expires_at).getTime() > Date.now()
  ) {
    const { data: rev } = await params.supabase
      .from("sorteo_revendedores")
      .select("id, codigo_referido, activo, sorteo_id")
      .eq("id", click.revendedor_id)
      .eq("empresa_id", params.empresaId)
      .maybeSingle();

    const r = rev as
      | { id: string; codigo_referido: string; activo: boolean; sorteo_id: string }
      | null;

    if (!r || !r.activo || r.sorteo_id !== sorteoId) {
      return;
    }

    const { error: upSess } = await params.supabase
      .from("chat_flow_sessions")
      .update({
        revendedor_id: r.id,
        codigo_referido_snapshot: r.codigo_referido,
        referral_source: "click_token",
      })
      .eq("id", sid)
      .eq("empresa_id", params.empresaId)
      .is("revendedor_id", null);

    if (upSess) {
      console.warn(LOG, "session_update_click_failed", upSess.message);
      return;
    }

    await params.supabase
      .from("sorteo_revendedor_clicks")
      .update({
        redeemed_at: nowIso,
        conversation_id: params.conversationId,
        flow_session_id: sid,
        contact_phone_norm: params.contactPhoneDigits || null,
      })
      .eq("id", click.id)
      .is("redeemed_at", null);

    await setFirstRevendedorOnConversation(
      params.supabase,
      params.empresaId,
      params.conversationId,
      r.id
    );

    console.info(LOG, "attributed_click_token", {
      conversationId: params.conversationId,
      flowSessionId: sid,
      revendedorId: r.id,
    });
    return;
  }

  const { data: byCode } = await params.supabase
    .from("sorteo_revendedores")
    .select("id, codigo_referido, activo, sorteo_id")
    .eq("empresa_id", params.empresaId)
    .eq("sorteo_id", sorteoId)
    .ilike("codigo_referido", tokenRaw)
    .maybeSingle();

  const rc = byCode as
    | { id: string; codigo_referido: string; activo: boolean; sorteo_id: string }
    | null;

  if (!rc || !rc.activo) {
    return;
  }

  const { error: upSess2 } = await params.supabase
    .from("chat_flow_sessions")
    .update({
      revendedor_id: rc.id,
      codigo_referido_snapshot: rc.codigo_referido,
      referral_source: "inbound_text",
    })
    .eq("id", sid)
    .eq("empresa_id", params.empresaId)
    .is("revendedor_id", null);

  if (upSess2) {
    console.warn(LOG, "session_update_code_failed", upSess2.message);
    return;
  }

  await setFirstRevendedorOnConversation(
    params.supabase,
    params.empresaId,
    params.conversationId,
    rc.id
  );

  console.info(LOG, "attributed_inbound_code", {
    conversationId: params.conversationId,
    flowSessionId: sid,
    revendedorId: rc.id,
  });
}

async function setFirstRevendedorOnConversation(
  supabase: SupabaseAdmin,
  empresaId: string,
  conversationId: string,
  revendedorId: string
): Promise<void> {
  const { data: conv } = await supabase
    .from("chat_conversations")
    .select("first_revendedor_id")
    .eq("id", conversationId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if ((conv as { first_revendedor_id?: string | null } | null)?.first_revendedor_id) {
    return;
  }

  await supabase
    .from("chat_conversations")
    .update({
      first_revendedor_id: revendedorId,
      first_referral_captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("empresa_id", empresaId)
    .is("first_revendedor_id", null);
}
