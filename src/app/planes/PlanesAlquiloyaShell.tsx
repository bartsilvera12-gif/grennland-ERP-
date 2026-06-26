"use client";

import PlanesPublicacionClient from "./PlanesPublicacionClient";

/**
 * Pantalla unificada de "Promociones" para instancias inmobiliarias
 * (AlquiloYa / GreenLand). Antes tenía tabs Planes/Packs; a pedido del
 * cliente quedó solo el listado de promociones. ImpulsosPacksClient sigue
 * accesible vía /dashboard/impulsos-packs.
 */
export default function PlanesAlquiloyaShell() {
  return (
    <div className="px-6 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Promociones</h1>
        <p className="mt-1 text-sm text-slate-500">
          Promociones que se exhiben en la web pública. Los cambios aparecen automáticamente — el CTA de cada card lleva al link que cargues en el campo &quot;CTA&quot; (recomendado: enlace de WhatsApp tipo
          {" "}
          <code className="rounded bg-slate-100 px-1 text-[12px] text-slate-700">https://wa.me/595XXXXXXXXX?text=...</code>).
        </p>
      </header>

      <PlanesPublicacionClient hideHeader />
    </div>
  );
}
