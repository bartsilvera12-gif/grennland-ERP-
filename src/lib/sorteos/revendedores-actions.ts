import { getEmpresaId } from "@/lib/db/empresa";
import { supabase } from "@/lib/supabase";

export type SorteoRevendedorRow = {
  id: string;
  empresa_id: string;
  sorteo_id: string;
  nombre: string;
  telefono: string | null;
  codigo_referido: string;
  activo: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function mapRev(r: Record<string, unknown>): SorteoRevendedorRow {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    sorteo_id: r.sorteo_id as string,
    nombre: (r.nombre as string) ?? "",
    telefono: (r.telefono as string) ?? null,
    codigo_referido: (r.codigo_referido as string) ?? "",
    activo: r.activo === true,
    metadata:
      typeof r.metadata === "object" && r.metadata !== null && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {},
    created_at: (r.created_at as string) ?? "",
    updated_at: (r.updated_at as string) ?? "",
  };
}

export async function listRevendedoresBySorteo(sorteoId: string): Promise<SorteoRevendedorRow[]> {
  const empresaId = await getEmpresaId();
  const { data, error } = await supabase
    .from("sorteo_revendedores")
    .select("*")
    .eq("sorteo_id", sorteoId)
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((x) => mapRev(x as Record<string, unknown>));
}

export type RevendedorInput = {
  nombre: string;
  telefono?: string | null;
  codigo_referido: string;
  activo?: boolean;
};

export async function createRevendedor(sorteoId: string, input: RevendedorInput): Promise<SorteoRevendedorRow> {
  const empresa_id = await getEmpresaId();
  const codigo = input.codigo_referido.trim();
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");
  if (!codigo) throw new Error("El código de referido es obligatorio.");
  if (codigo.length > 48) throw new Error("El código no puede superar 48 caracteres.");

  const { data: sorteo, error: se } = await supabase
    .from("sorteos")
    .select("id")
    .eq("id", sorteoId)
    .eq("empresa_id", empresa_id)
    .maybeSingle();
  if (se) throw new Error(se.message);
  if (!sorteo) throw new Error("Sorteo no encontrado.");

  const { data, error } = await supabase
    .from("sorteo_revendedores")
    .insert({
      empresa_id,
      sorteo_id: sorteoId,
      nombre,
      telefono: input.telefono?.trim() || null,
      codigo_referido: codigo,
      activo: input.activo !== false,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRev(data as Record<string, unknown>);
}

export async function updateRevendedor(
  id: string,
  input: RevendedorInput
): Promise<SorteoRevendedorRow> {
  const empresa_id = await getEmpresaId();
  const codigo = input.codigo_referido.trim();
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");
  if (!codigo) throw new Error("El código de referido es obligatorio.");

  const { data, error } = await supabase
    .from("sorteo_revendedores")
    .update({
      nombre,
      telefono: input.telefono?.trim() || null,
      codigo_referido: codigo,
      activo: input.activo !== false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("empresa_id", empresa_id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRev(data as Record<string, unknown>);
}

export async function setRevendedorActivo(id: string, activo: boolean): Promise<void> {
  const empresa_id = await getEmpresaId();
  const { error } = await supabase
    .from("sorteo_revendedores")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("empresa_id", empresa_id);

  if (error) throw new Error(error.message);
}

export type RevendedorStats = {
  clicks: number;
  clicks_redeemed: number;
  sesiones_atribuidas: number;
  ordenes: number;
  monto_total: number;
  cupones: number;
};

export async function getRevendedorStats(revendedorId: string): Promise<RevendedorStats> {
  const empresa_id = await getEmpresaId();

  const { count: clicks, error: e1 } = await supabase
    .from("sorteo_revendedor_clicks")
    .select("id", { count: "exact", head: true })
    .eq("revendedor_id", revendedorId)
    .eq("empresa_id", empresa_id);
  if (e1) throw new Error(e1.message);

  const { count: clicksRedeemed, error: e2 } = await supabase
    .from("sorteo_revendedor_clicks")
    .select("id", { count: "exact", head: true })
    .eq("revendedor_id", revendedorId)
    .eq("empresa_id", empresa_id)
    .not("redeemed_at", "is", null);
  if (e2) throw new Error(e2.message);

  const { count: sesiones, error: e3 } = await supabase
    .from("chat_flow_sessions")
    .select("id", { count: "exact", head: true })
    .eq("revendedor_id", revendedorId)
    .eq("empresa_id", empresa_id);
  if (e3) throw new Error(e3.message);

  const { data: ordenesRows, error: e4 } = await supabase
    .from("sorteo_entradas")
    .select("id, monto_total, cantidad_boletos")
    .eq("revendedor_id", revendedorId)
    .eq("empresa_id", empresa_id);
  if (e4) throw new Error(e4.message);

  const ordenes = ordenesRows?.length ?? 0;
  let monto_total = 0;
  let cupones = 0;
  for (const r of ordenesRows ?? []) {
    const row = r as { monto_total?: unknown; cantidad_boletos?: unknown };
    const m = Number(row.monto_total);
    if (Number.isFinite(m)) monto_total += m;
    const c = Number(row.cantidad_boletos);
    if (Number.isFinite(c) && c > 0) cupones += Math.trunc(c);
  }

  return {
    clicks: clicks ?? 0,
    clicks_redeemed: clicksRedeemed ?? 0,
    sesiones_atribuidas: sesiones ?? 0,
    ordenes,
    monto_total,
    cupones,
  };
}
