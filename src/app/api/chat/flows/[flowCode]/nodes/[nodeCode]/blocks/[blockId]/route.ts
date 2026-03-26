import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAuthWithRol } from "@/lib/middleware/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase no configurado");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ flowCode: string; nodeCode: string; blockId: string }> }
) {
  try {
    const auth = await getAuthWithRol();
    if (!auth?.empresa_id) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }
    const params = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      block_type?: string;
      content_text?: string | null;
      media_url?: string | null;
      sort_order?: number;
    };
    const patch: Record<string, unknown> = {};
    if (typeof body.block_type === "string" && ["text", "image", "buttons"].includes(body.block_type)) {
      patch.block_type = body.block_type;
    }
    if ("content_text" in body) patch.content_text = body.content_text ?? null;
    if ("media_url" in body) patch.media_url = body.media_url ?? null;
    if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
      patch.sort_order = Math.trunc(body.sort_order);
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("chat_flow_node_blocks")
      .update(patch)
      .eq("id", params.blockId)
      .eq("empresa_id", auth.empresa_id)
      .select("id, node_id, block_type, content_text, media_url, sort_order, created_at")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ ok: false, error: "Bloque no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    console.error("[api/chat/flows/:flowCode/nodes/:nodeCode/blocks/:blockId][PATCH]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ flowCode: string; nodeCode: string; blockId: string }> }
) {
  try {
    const auth = await getAuthWithRol();
    if (!auth?.empresa_id) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }
    const params = await context.params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("chat_flow_node_blocks")
      .delete()
      .eq("id", params.blockId)
      .eq("empresa_id", auth.empresa_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/chat/flows/:flowCode/nodes/:nodeCode/blocks/:blockId][DELETE]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
