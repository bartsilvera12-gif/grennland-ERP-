import { listErpTestimonios, type TestimonioRow } from "@/lib/alquiloya/erp-testimonios";
import TestimoniosClient from "./TestimoniosClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TestimoniosPage() {
  let rows: TestimonioRow[] = [];
  let loadError: string | null = null;
  try {
    rows = await listErpTestimonios();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Error desconocido";
    console.error("[dashboard/testimonios] load", e);
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Testimonios</h1>
        <p className="mt-1 text-sm text-slate-500">
          Reseñas que aparecen en el home público. Las marcadas como destacadas se muestran primero.
        </p>
      </header>
      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudieron cargar los testimonios: {loadError}
        </div>
      ) : (
        <TestimoniosClient initial={rows} />
      )}
    </div>
  );
}
