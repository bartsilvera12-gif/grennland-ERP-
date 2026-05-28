import Link from "next/link";
import { notFound } from "next/navigation";
import { getErpPropietario } from "@/lib/alquiloya/erp-agentes-inmobiliarios";
import { PropietarioForm } from "../../PropietarioForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export default async function EditarPropietarioPage({ params }: Props) {
  const { id } = await params;
  const p = await getErpPropietario(id);
  if (!p) notFound();

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <Link
          href={`/dashboard/agentes-inmobiliarios/propietarios/${p.id}`}
          className="mb-2 inline-flex text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
        >
          ← Volver al detalle
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Editar propietario</h1>
        <p className="mt-1 text-sm text-slate-500">{p.nombre}</p>
      </header>

      <PropietarioForm
        mode="edit"
        initial={{
          id: p.id,
          nombre: p.nombre,
          email: p.email ?? "",
          telefono: p.telefono ?? "",
          documento: p.documento ?? "",
          tipo_persona: p.tipo_persona ?? "",
          estado: p.estado ?? "",
          activo: p.activo,
          plan_publicacion_id: p.plan_publicacion_id ?? "",
          observaciones: p.observaciones ?? "",
        }}
      />
    </div>
  );
}
