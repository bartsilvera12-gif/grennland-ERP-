import ImpulsosPacksClient from "./ImpulsosPacksClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function ImpulsosPacksPage() {
  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Packs de impulsos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Catálogo de packs que ve el cliente en la web pública (sección Destacar propiedad). Los cambios aparecen automáticamente.
        </p>
      </header>
      <ImpulsosPacksClient />
    </div>
  );
}
