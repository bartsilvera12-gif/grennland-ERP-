"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CONTRATO_AFILIADOS_CLAUSULAS,
  CONTRATO_AFILIADOS_INTRO,
  CONTRATO_AFILIADOS_VERSION,
} from "@/lib/legal/contrato-afiliados";

type Canal = "instagram" | "tiktok" | "whatsapp" | "web" | "otro";

const CANALES: { value: Canal; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "web", label: "Web / blog" },
  { value: "otro", label: "Otro" },
];

export default function PortalReferidosLandingClient() {
  return (
    <Suspense fallback={null}>
      <PortalReferidosLandingInner />
    </Suspense>
  );
}

function PortalReferidosLandingInner() {
  const searchParams = useSearchParams();
  // Si vienen desde /portal-referidos/login -> "Solicitar credenciales" con
  // ?solicitar=1, abrimos directo el form sin pasar por la landing.
  const initialMode: "landing" | "form" | "sent" =
    searchParams?.get("solicitar") === "1" ? "form" : "landing";
  const [mode, setMode] = useState<"landing" | "form" | "sent">(initialMode);

  // Si cambia el query param mientras estamos en la pagina, sincronizamos.
  useEffect(() => {
    if (searchParams?.get("solicitar") === "1" && mode === "landing") {
      setMode("form");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [canal, setCanal] = useState<Canal>("instagram");
  const [mensaje, setMensaje] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [showTerminos, setShowTerminos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showTerminos) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowTerminos(false);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showTerminos]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) { setError("Ingresá tu nombre."); return; }
    if (!email.trim() && !telefono.trim()) {
      setError("Ingresá al menos email o teléfono.");
      return;
    }
    if (!aceptaTerminos) {
      setError("Tenés que aceptar las Bases y Condiciones del Programa de Afiliados.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/alquiloya/solicitudes-acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "referido_partner",
          sub_tipo: canal,
          nombre: nombre.trim(),
          email: email.trim() || null,
          telefono: telefono.trim() || null,
          mensaje: mensaje.trim() || null,
          acepto_terminos: true,
          terminos_version: CONTRATO_AFILIADOS_VERSION,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setMode("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh w-full bg-gradient-to-b from-[#EAF4FF] via-white to-white px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <Link href="/publico" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/alquiloya-legacy/assets/logo.png"
            alt="AlquiloYa"
            width={180}
            height={52}
            className="h-auto w-[180px] object-contain"
          />
        </Link>

        {mode === "landing" ? (
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.25)] sm:p-7">
            <h1 className="text-center text-xl font-bold text-[#0F172A] sm:text-2xl">
              Portal de referidos
            </h1>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
              Seguimiento de tus clicks, conversiones y comisiones del programa AlquiloYa.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/portal-referidos/login"
                className="inline-flex w-full items-center justify-center rounded-full bg-[#0058A5] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(0,88,165,0.5)] transition-colors hover:bg-[#004B8F] active:scale-[0.98]"
              >
                Ya tengo cuenta
              </Link>
              <button
                type="button"
                onClick={() => setMode("form")}
                className="inline-flex w-full items-center justify-center rounded-full border border-[#0058A5]/30 bg-white px-5 py-3 text-sm font-semibold text-[#0058A5] transition-colors hover:bg-[#EAF4FF] active:scale-[0.98]"
              >
                Quiero ser referido
              </button>
            </div>
          </div>
        ) : null}

        {mode === "form" ? (
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.25)] sm:p-7">
            <h1 className="text-center text-xl font-bold text-[#0F172A] sm:text-2xl">
              {initialMode === "form" ? "Solicitar credenciales" : "Sumate al programa"}
            </h1>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
              {initialMode === "form"
                ? "Llená el formulario y el equipo de AlquiloYa te envía las credenciales por WhatsApp."
                : "Cuando aprobemos tu solicitud te enviamos tu link único y credenciales por WhatsApp."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">Nombre o marca *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  placeholder="Ej. Juan Pérez / Alquileres PY"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#0058A5] focus:outline-none focus:ring-2 focus:ring-[#0058A5]/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@dominio.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#0058A5] focus:outline-none focus:ring-2 focus:ring-[#0058A5]/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">WhatsApp</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="0981 000 000"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#0058A5] focus:outline-none focus:ring-2 focus:ring-[#0058A5]/30"
                />
                <p className="mt-1 text-[11px] text-slate-500">Ingresá al menos email o WhatsApp.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">¿Por dónde difundís?</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CANALES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCanal(c.value)}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                        canal === c.value
                          ? "border-[#0058A5] bg-[#0058A5] text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#0F172A]">Mensaje (opcional)</label>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={3}
                  placeholder="Contanos tu audiencia, redes, etc."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] shadow-sm focus:border-[#0058A5] focus:outline-none focus:ring-2 focus:ring-[#0058A5]/30"
                />
              </div>
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-700">
                <input
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={(e) => setAceptaTerminos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0058A5] focus:ring-[#0058A5]"
                />
                <span>
                  Leí y acepto las{" "}
                  <button
                    type="button"
                    onClick={() => setShowTerminos(true)}
                    className="font-semibold text-[#0058A5] underline-offset-2 hover:underline"
                  >
                    Bases y Condiciones del Programa de Afiliados
                  </button>
                  .
                </span>
              </label>
              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#0058A5] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(0,88,165,0.5)] transition-colors hover:bg-[#004B8F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Enviando…" : "Enviar solicitud"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("landing")}
                  className="text-xs text-slate-500 underline-offset-4 hover:text-[#0058A5] hover:underline"
                >
                  ← Volver
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {mode === "sent" ? (
          <div className="w-full rounded-2xl border border-emerald-200 bg-white p-6 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.25)] sm:p-7">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-center text-lg font-bold text-[#0F172A]">¡Solicitud recibida!</h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
              Vamos a revisarla y te contactamos por WhatsApp con tu link único y credenciales para entrar al portal.
            </p>
            <Link
              href="/publico"
              className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Volver al inicio
            </Link>
          </div>
        ) : null}

        {mode !== "sent" ? (
          <Link
            href="/publico"
            className="text-sm text-slate-500 underline-offset-4 hover:text-[#0058A5] hover:underline"
          >
            ← Volver al inicio
          </Link>
        ) : null}
      </div>

      {showTerminos ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="terminos-titulo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 px-3 py-4 sm:items-center sm:px-4 sm:py-8"
          onClick={() => setShowTerminos(false)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#0058A5]">
                  Programa de afiliados
                </p>
                <h2 id="terminos-titulo" className="mt-0.5 text-lg font-bold text-[#0F172A]">
                  Contrato de Adhesión
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Versión {CONTRATO_AFILIADOS_VERSION}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTerminos(false)}
                aria-label="Cerrar"
                className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-700">
              <div className="space-y-2">
                {CONTRATO_AFILIADOS_INTRO.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <div className="mt-5 space-y-5">
                {CONTRATO_AFILIADOS_CLAUSULAS.map((c) => (
                  <section key={c.titulo}>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#0F172A]">
                      {c.titulo}
                    </h3>
                    <div className="mt-1.5 space-y-1.5">
                      {c.bloques.map((b, i) =>
                        b.tipo === "p" ? (
                          <p key={i}>{b.texto}</p>
                        ) : (
                          <ul key={i} className="ml-5 list-disc space-y-1">
                            {b.items.map((it, j) => (
                              <li key={j}>{it}</li>
                            ))}
                          </ul>
                        ),
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </div>
            <footer className="flex flex-col gap-2 border-t border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] leading-relaxed text-slate-500">
                Tildá la casilla para aceptar electrónicamente.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowTerminos(false)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAceptaTerminos(true);
                    setShowTerminos(false);
                  }}
                  className="rounded-full bg-[#0058A5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#004B8F]"
                >
                  Acepto
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </main>
  );
}
