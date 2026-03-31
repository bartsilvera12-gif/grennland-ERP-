import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSorteoById } from "@/lib/sorteos/actions";
import { listRevendedoresBySorteo } from "@/lib/sorteos/revendedores-actions";
import SorteoRevendedoresClient from "./SorteoRevendedoresClient";

export default async function SorteoRevendedoresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sorteo = await getSorteoById(id);
  if (!sorteo) notFound();

  const revendedores = await listRevendedoresBySorteo(id);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : "";

  return (
    <SorteoRevendedoresClient
      sorteoId={id}
      sorteoNombre={sorteo.nombre}
      initialRows={revendedores}
      baseUrl={baseUrl}
    />
  );
}
