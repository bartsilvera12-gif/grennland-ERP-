import { resolveDataSchemaForCurrentUserServer } from "@/lib/supabase/empresa-data-server";
import ProyectoDetalleClient from "./ProyectoDetalleClient";

export default async function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let dataSchema = "zentra_erp";
  try {
    dataSchema = await resolveDataSchemaForCurrentUserServer();
  } catch (e) {
    console.error("[dashboard/proyectos/[id]] resolveDataSchemaForCurrentUserServer", e);
  }
  return <ProyectoDetalleClient params={params} dataSchema={dataSchema} />;
}
