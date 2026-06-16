import Link from "next/link";
import {
  CONTRATO_AFILIADOS_CLAUSULAS,
  CONTRATO_AFILIADOS_INTRO,
  CONTRATO_AFILIADOS_VERSION,
} from "@/lib/legal/contrato-afiliados";

export const metadata = {
  title: "Contrato de Afiliados · AlquiloYa",
  description:
    "Bases y condiciones del Programa de Afiliados de AlquiloYa que se aceptan al solicitar credenciales del portal de referidos.",
};

export default function ContratoAfiliadosPage() {
  return (
    <main className="min-h-dvh w-full bg-gradient-to-b from-[#EAF4FF] via-white to-white px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link
          href="/portal-referidos"
          className="text-sm text-slate-500 underline-offset-4 hover:text-[#0058A5] hover:underline"
        >
          ← Volver al portal de referidos
        </Link>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.25)] sm:p-8">
          <header className="mb-6 border-b border-slate-200 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0058A5]">
              Programa de afiliados
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#0F172A] sm:text-3xl">
              Contrato de Adhesión al Programa de Afiliados
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              www.alquiloya.com.py · Versión {CONTRATO_AFILIADOS_VERSION}
            </p>
          </header>

          <div className="space-y-3 text-sm leading-relaxed text-slate-700">
            {CONTRATO_AFILIADOS_INTRO.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <div className="mt-6 space-y-6">
            {CONTRATO_AFILIADOS_CLAUSULAS.map((c) => (
              <section key={c.titulo}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#0F172A]">
                  {c.titulo}
                </h2>
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
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

          <footer className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
            La aceptación electrónica de estas Bases y Condiciones al completar
            el formulario de registro tiene la misma validez jurídica que la
            firma manuscrita, conforme a la legislación paraguaya aplicable.
          </footer>
        </article>
      </div>
    </main>
  );
}
