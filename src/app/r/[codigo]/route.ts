import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-admin";

export const dynamic = "force-dynamic";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Landing pública: registra click + token opaco y redirige a WhatsApp.
 * URL oficial: /r/{codigo}?sorteo={uuid}
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo: codigoRaw } = await context.params;
  const codigo = decodeURIComponent(codigoRaw ?? "").trim();
  const sorteoId = request.nextUrl.searchParams.get("sorteo")?.trim() ?? "";
  if (!codigo || !sorteoId) {
    return new NextResponse("Falta código en la ruta o sorteo en ?sorteo=uuid", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const phone = digitsOnly(
    process.env.WHATSAPP_LINK_PHONE_NUMBER?.trim() ||
      process.env.NEXT_PUBLIC_WHATSAPP_LINK_PHONE_NUMBER?.trim() ||
      ""
  );
  if (!phone || phone.length < 8) {
    return new NextResponse(
      "Configurá WHATSAPP_LINK_PHONE_NUMBER en el servidor (E.164 sin +, ej. 595981234567).",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return new NextResponse("Servidor sin credenciales Supabase (service role).", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const { data: rev, error: rErr } = await supabase
    .from("sorteo_revendedores")
    .select("id, empresa_id, sorteo_id, codigo_referido, activo")
    .eq("sorteo_id", sorteoId)
    .ilike("codigo_referido", codigo)
    .eq("activo", true)
    .maybeSingle();

  if (rErr || !rev) {
    return new NextResponse("Enlace inválido o revendedor inactivo.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const row = rev as {
    id: string;
    empresa_id: string;
    sorteo_id: string;
    codigo_referido: string;
    activo: boolean;
  };

  const token = randomBytes(18).toString("base64url");
  const ua = request.headers.get("user-agent") ?? "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insErr } = await supabase.from("sorteo_revendedor_clicks").insert({
    empresa_id: row.empresa_id,
    sorteo_id: row.sorteo_id,
    revendedor_id: row.id,
    attribution_token: token,
    user_agent: ua.slice(0, 512),
    ip_hash: ipHash,
    expires_at: expires,
  });

  if (insErr) {
    console.error("[sorteo-r]", insErr.message);
    return new NextResponse("No se pudo registrar el click.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const text = `Hola quiero comprar boletas ref=${token}`;
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  return NextResponse.redirect(waUrl, 302);
}
