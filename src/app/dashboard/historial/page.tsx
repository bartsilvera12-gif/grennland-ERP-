import { redirect } from "next/navigation";

/**
 * Página redundante: el historial omnicanal vigente vive en
 * `/dashboard/historial-omnicanal` (la que enlaza el Sidebar). Esta ruta
 * quedó huérfana con una implementación paralela más vieja; la redirigimos
 * para evitar dos pantallas distintas del mismo historial.
 */
export default function DashboardHistorialRedirectPage() {
  redirect("/dashboard/historial-omnicanal");
}
