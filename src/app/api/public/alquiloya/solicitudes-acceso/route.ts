import { NextResponse } from "next/server";
import { getChatPostgresPool } from "@/lib/supabase/chat-pg-pool";
import { queryWithRetry } from "@/lib/supabase/pg-retry";
import { successResponse, errorResponse } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALQUILOYA_EMPRESA_ID = "cf5df6fb-7705-4c4e-b29c-97bf5f314d8f";

function s(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const x = v.trim();
  if (!x) return null;
  return x.slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const tipoRaw = s(body.tipo, 20);
    if (tipoRaw !== "agente" && tipoRaw !== "propietario" && tipoRaw !== "referido_partner") {
      return NextResponse.json(errorResponse("tipo invalido"), { status: 400 });
    }
    const tipo = tipoRaw;

    let subTipo: string | null = null;
    if (tipo === "agente") {
      const v = s(body.sub_tipo, 40);
      if (v !== "Independiente" && v !== "Inmobiliaria") {
        return NextResponse.json(errorResponse("sub_tipo invalido (Independiente|Inmobiliaria)"), { status: 400 });
      }
      subTipo = v;
    } else if (tipo === "referido_partner") {
      // Para referidos el sub_tipo guarda el canal: instagram | tiktok | whatsapp | web | otro.
      const v = (s(body.sub_tipo, 40) ?? "").toLowerCase();
      const allowed = ["instagram", "tiktok", "whatsapp", "web", "otro"];
      subTipo = allowed.includes(v) ? v : "otro";
    }

    const nombre = s(body.nombre, 160);
    if (!nombre) return NextResponse.json(errorResponse("nombre requerido"), { status: 400 });

    const email = s(body.email, 160);
    const telefono = s(body.telefono, 40);
    if (!email && !telefono) {
      return NextResponse.json(errorResponse("ingresá al menos email o telefono"), { status: 400 });
    }

    const empresa = s(body.empresa, 160);
    const ciudad = s(body.ciudad, 80);
    const mensaje = s(body.mensaje, 1200);
    const planTier = s(body.plan_tier_solicitado, 40);

    // Afiliados (referido_partner): obligamos a aceptar las Bases y Condiciones
    // antes de aceptar la solicitud. Para los demas tipos quedan opcionales (al
    // menos por ahora) para no romper flujos existentes.
    const aceptoTerminos = body.acepto_terminos === true;
    const terminosVersion = s(body.terminos_version, 40);
    if (tipo === "referido_partner" && !aceptoTerminos) {
      return NextResponse.json(
        errorResponse("Tenes que aceptar las Bases y Condiciones del Programa de Afiliados."),
        { status: 400 }
      );
    }

    const pool = getChatPostgresPool();
    if (!pool) {
      return NextResponse.json(errorResponse("Pool no disponible"), { status: 500 });
    }

    // Detectar columnas opcionales (instancias sin la migration corren igual).
    async function colExists(name: string): Promise<boolean> {
      try {
        const { rows: cols } = await queryWithRetry<{ ok: boolean }>(
          pool!,
          `SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
              WHERE table_schema='alquiloya' AND table_name='solicitudes_acceso' AND column_name=$1
           ) AS ok`,
          [name]
        );
        return cols[0]?.ok === true;
      } catch {
        return false;
      }
    }
    const [hasPlanTier, hasTerminosAt, hasTerminosVer, hasTerminosIp] = await Promise.all([
      colExists("plan_tier_solicitado"),
      colExists("terminos_aceptados_at"),
      colExists("terminos_version"),
      colExists("terminos_ip"),
    ]);

    // IP del solicitante para auditoria de la aceptacion (mejor esfuerzo:
    // proxies / CDN inyectan x-forwarded-for; tomamos la primera entrada).
    const ipHeader =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      null;
    const terminosIp = aceptoTerminos
      ? (ipHeader ? ipHeader.split(",")[0]?.trim().slice(0, 64) : null)
      : null;

    const cols: string[] = ["empresa_id", "tipo", "sub_tipo", "nombre", "email", "telefono", "empresa", "ciudad", "mensaje", "estado"];
    const vals: unknown[] = [ALQUILOYA_EMPRESA_ID, tipo, subTipo, nombre, email, telefono, empresa, ciudad, mensaje, "pendiente"];
    if (hasPlanTier) { cols.push("plan_tier_solicitado"); vals.push(planTier); }
    if (hasTerminosAt && aceptoTerminos) { cols.push("terminos_aceptados_at"); vals.push(new Date().toISOString()); }
    if (hasTerminosVer && aceptoTerminos) { cols.push("terminos_version"); vals.push(terminosVersion); }
    if (hasTerminosIp && aceptoTerminos && terminosIp) { cols.push("terminos_ip"); vals.push(terminosIp); }

    const placeholders = cols.map((c, i) => (c === "empresa_id" ? `$${i + 1}::uuid` : `$${i + 1}`)).join(", ");
    const sql = `INSERT INTO "alquiloya"."solicitudes_acceso" (${cols.map((c) => `"${c}"`).join(", ")})
                 VALUES (${placeholders})
                 RETURNING id`;

    const { rows } = await queryWithRetry<{ id: string }>(pool, sql, vals);
    return NextResponse.json(successResponse({ id: rows[0].id }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/public/alquiloya/solicitudes-acceso POST]", msg);
    return NextResponse.json(errorResponse("No se pudo registrar la solicitud: " + msg), { status: 500 });
  }
}
