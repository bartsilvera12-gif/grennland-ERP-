import { resolveDataSchemaForCurrentUserServer } from "@/lib/supabase/empresa-data-server";
import ProyectosKanbanClient from "./ProyectosKanbanClient";

export default async function ProyectosPage() {
  let dataSchema = "zentra_erp";
  try {
    dataSchema = await resolveDataSchemaForCurrentUserServer();
  } catch (e) {
    console.error("[dashboard/proyectos] resolveDataSchemaForCurrentUserServer", e);
  }
  return <ProyectosKanbanClient dataSchema={dataSchema} />;
}
