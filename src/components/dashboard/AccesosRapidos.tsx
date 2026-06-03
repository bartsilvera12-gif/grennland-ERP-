"use client";

import Link from "next/link";
import type { ModulosDisponibles } from "./GerencialOverview";

type Accion = {
  key: string;
  label: string;
  href: string;
  // condicionToShow recibe los módulos y decide si renderizar
  shouldShow: (m: ModulosDisponibles) => boolean;
  icon: React.ReactNode;
};

const ACCIONES: Accion[] = [
  {
    key: "nueva-propiedad",
    label: "Nueva propiedad",
    href: "/dashboard/propiedades/nueva",
    shouldShow: (m) => m.propiedades,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12L12 3l9 9"/><path d="M5 10v10h14V10"/></svg>
    ),
  },
  {
    key: "nuevo-agente",
    label: "Nuevo agente",
    href: "/dashboard/agentes-inmobiliarios/agentes/nuevo",
    shouldShow: (m) => m.agentes,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
    ),
  },
  {
    key: "nuevo-propietario",
    label: "Nuevo propietario",
    href: "/dashboard/agentes-inmobiliarios/propietarios/nuevo",
    shouldShow: (m) => m.propietarios,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
    ),
  },
  {
    key: "solicitudes",
    label: "Solicitudes",
    href: "/dashboard/solicitudes-acceso",
    shouldShow: (m) => m.solicitudes_acceso || m.solicitudes_servicio,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
    ),
  },
  {
    key: "captaciones",
    label: "Captaciones",
    href: "/dashboard/agentes-inmobiliarios/captaciones",
    shouldShow: (m) => m.agente_captaciones,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
    ),
  },
  {
    key: "resenas",
    label: "Reseñas",
    href: "/dashboard/agente-resenas",
    shouldShow: (m) => m.agente_resenas,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    ),
  },
];

export default function AccesosRapidos({ modulos }: { modulos: ModulosDisponibles }) {
  const visibles = ACCIONES.filter((a) => a.shouldShow(modulos));
  if (visibles.length === 0) return null;
  return (
    <nav aria-label="Accesos rápidos" className="flex flex-wrap items-center gap-1.5">
      {visibles.map((a) => (
        <Link
          key={a.key}
          href={a.href}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[#4FAEB2] hover:bg-[#4FAEB2]/5 hover:text-[#3F8E91]"
        >
          {a.icon}
          <span>{a.label}</span>
        </Link>
      ))}
    </nav>
  );
}
