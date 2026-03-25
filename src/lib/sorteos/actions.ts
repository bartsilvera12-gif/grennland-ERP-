import { getEmpresaId } from "@/lib/db/empresa";
import { supabase } from "@/lib/supabase";
import type {
  Sorteo,
  SorteoConversacion,
  SorteoCupon,
  SorteoEntrada,
  SorteoEstado,
} from "@/lib/sorteos/types";

function mapSorteo(r: Record<string, unknown>): Sorteo {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    nombre: (r.nombre as string) ?? "",
    descripcion: (r.descripcion as string) ?? null,
    precio_por_boleto: Number(r.precio_por_boleto) ?? 0,
    max_boletos: Number(r.max_boletos) ?? 0,
    total_boletos_vendidos: Number(r.total_boletos_vendidos) ?? 0,
    ultimo_numero_cupon: Number(r.ultimo_numero_cupon) ?? 0,
    fecha_sorteo: (r.fecha_sorteo as string) ?? null,
    estado: (r.estado as SorteoEstado) ?? "activo",
    datos_bancarios: (typeof r.datos_bancarios === "object" && r.datos_bancarios !== null
      ? (r.datos_bancarios as Record<string, unknown>)
      : {}) as Record<string, unknown>,
    imagen_url: (r.imagen_url as string) ?? null,
    created_at: (r.created_at as string) ?? "",
    updated_at: (r.updated_at as string) ?? "",
  };
}

export async function getSorteos(): Promise<Sorteo[]> {
  const { data, error } = await supabase
    .from("sorteos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapSorteo(r as Record<string, unknown>));
}

export async function getSorteoById(id: string): Promise<Sorteo | null> {
  const { data, error } = await supabase.from("sorteos").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapSorteo(data as Record<string, unknown>) : null;
}

export type SorteoInput = {
  nombre: string;
  descripcion?: string;
  precio_por_boleto: number;
  max_boletos: number;
  fecha_sorteo?: string | null;
  estado: SorteoEstado;
  datos_bancarios: Record<string, unknown>;
  imagen_url?: string | null;
};

export async function createSorteo(input: SorteoInput): Promise<Sorteo> {
  const empresa_id = await getEmpresaId();
  const { data, error } = await supabase
    .from("sorteos")
    .insert({
      empresa_id,
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      precio_por_boleto: input.precio_por_boleto,
      max_boletos: input.max_boletos,
      fecha_sorteo: input.fecha_sorteo || null,
      estado: input.estado,
      datos_bancarios: input.datos_bancarios,
      imagen_url: input.imagen_url?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapSorteo(data as Record<string, unknown>);
}

export async function updateSorteo(id: string, input: SorteoInput): Promise<Sorteo> {
  const { data, error } = await supabase
    .from("sorteos")
    .update({
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      precio_por_boleto: input.precio_por_boleto,
      max_boletos: input.max_boletos,
      fecha_sorteo: input.fecha_sorteo || null,
      estado: input.estado,
      datos_bancarios: input.datos_bancarios,
      imagen_url: input.imagen_url?.trim() || null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapSorteo(data as Record<string, unknown>);
}

export async function getSorteoConversaciones(): Promise<SorteoConversacion[]> {
  const { data, error } = await supabase
    .from("sorteo_conversaciones")
    .select("*, sorteos(nombre)")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SorteoConversacion[];
}

export async function getSorteoEntradas(): Promise<SorteoEntrada[]> {
  const { data, error } = await supabase
    .from("sorteo_entradas")
    .select("*, sorteos(nombre)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SorteoEntrada[];
}

export async function getSorteoCupones(): Promise<SorteoCupon[]> {
  const { data, error } = await supabase
    .from("sorteo_cupones")
    .select("*, sorteos(nombre), sorteo_entradas(nombre_participante)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SorteoCupon[];
}
