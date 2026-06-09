"use client";

import { useState } from "react";
import PlanesPublicacionClient from "./PlanesPublicacionClient";
import ImpulsosPacksClient from "../dashboard/impulsos-packs/ImpulsosPacksClient";

/**
 * Pantalla unificada de "Planes" para AlquiloYa.
 *
 * A pedido del cliente, los planes de publicacion y los packs de impulsos
 * conviven en la misma URL (/planes) bajo un tab toggle. La ruta legacy
 * /dashboard/impulsos-packs sigue funcionando, pero el sidebar apunta aca.
 */
type Tab = "planes" | "packs";

export default function PlanesAlquiloyaShell() {
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "planes";
    const p = new URLSearchParams(window.location.search);
    return p.get("tab") === "packs" ? "packs" : "planes";
  });

  function selectTab(next: Tab) {
    setTab(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "packs") url.searchParams.set("tab", "packs");
      else url.searchParams.delete("tab");
      window.history.replaceState(null, "", url.toString());
    }
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Planes</h1>
        <p className="mt-1 text-sm text-slate-500">
          {tab === "planes" ? (
            <>
              Planes de publicación que se exhiben en{" "}
              <code className="rounded bg-slate-100 px-1 text-[12px] text-slate-700">/publico#plans</code>.
              Los cambios aparecen automáticamente en la web pública.
            </>
          ) : (
            <>Catálogo de packs de impulsos que ve el cliente en la web pública (sección Destacar propiedad).</>
          )}
        </p>
      </header>

      {/* Tabs */}
      <nav className="mb-6 inline-flex rounded-2xl border border-[#4FAEB2]/45 bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => selectTab("planes")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "planes"
              ? "bg-[#4FAEB2] text-white shadow-md shadow-[#4FAEB2]/30"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          }`}
        >
          Planes de publicación
        </button>
        <button
          type="button"
          onClick={() => selectTab("packs")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "packs"
              ? "bg-[#4FAEB2] text-white shadow-md shadow-[#4FAEB2]/30"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          }`}
        >
          Packs de impulsos
        </button>
      </nav>

      {/* Body */}
      {tab === "planes" ? <PlanesPublicacionClient hideHeader /> : <ImpulsosPacksClient />}
    </div>
  );
}
