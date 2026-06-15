import { notFound } from "next/navigation";
import { getErpPropiedad } from "@/lib/alquiloya/erp-propiedades";
import EditPropiedadClient from "./EditPropiedadClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function EditarPropiedadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const fromPendientes = sp.from === "pendientes";
  const p = await getErpPropiedad(id);
  if (!p) notFound();
  return <EditPropiedadClient initial={p} fromPendientes={fromPendientes} />;
}
