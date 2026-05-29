import Link from "next/link";

export const metadata = {
  title: "Portal de referidos — AlquiloYa",
  description:
    "Ingresá para ver tus clicks, conversiones y comisiones del programa de referidos AlquiloYa.",
};

export default function PortalReferidosLanding() {
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
            <a
              href={
                "https://wa.me/595981000000?text=" +
                encodeURIComponent("Hola, quiero unirme al programa de referidos AlquiloYa.")
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-full border border-[#0058A5]/30 bg-white px-5 py-3 text-sm font-semibold text-[#0058A5] transition-colors hover:bg-[#EAF4FF] active:scale-[0.98]"
            >
              Quiero ser referido
            </a>
          </div>
        </div>

        <Link
          href="/publico"
          className="text-sm text-slate-500 underline-offset-4 hover:text-[#0058A5] hover:underline"
        >
          ← Volver al inicio
        </Link>
      </div>
    </main>
  );
}
