"use client";

/**
 * Pantalla de carga premium con animación del logo ZENTRA.
 * El logo está compuesto por dos cursores triangulares agudos que
 * se cruzan formando una Z. La animación los separa hacia sus
 * respectivas esquinas (NE y SW) y los vuelve a juntar en loop.
 *
 * Diseñado para reemplazar las pantallas blancas planas de "Cargando…".
 * Tokens visuales: fondo slate-50, marca turquesa #4FAEB2.
 */
export default function ZentraLoader({
  label = "Cargando",
  fullscreen = true,
}: {
  label?: string;
  /** Si es true, ocupa min-h-screen. Si es false, se acomoda al contenedor. */
  fullscreen?: boolean;
}) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-7 bg-slate-50 ${
        fullscreen ? "min-h-screen" : "min-h-[40vh] py-16"
      }`}
      aria-busy="true"
      role="status"
    >
      {/* Logo: dos cursores cruzados */}
      <div className="relative h-24 w-24">
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full drop-shadow-[0_4px_18px_rgba(79,174,178,0.25)]"
          aria-hidden="true"
        >
          {/* Cursor superior: apex hacia top-right (NE), base hacia centro */}
          <path
            d="M 14 18 L 50 50 L 92 6 Z"
            fill="#4FAEB2"
            className="zentra-cursor-ne origin-[50%_50%]"
          />
          {/* Cursor inferior: apex hacia bottom-left (SW), base hacia centro */}
          <path
            d="M 86 82 L 50 50 L 8 94 Z"
            fill="#3F8E91"
            className="zentra-cursor-sw origin-[50%_50%]"
          />
        </svg>
        {/* Halo turquesa suave detrás */}
        <span
          aria-hidden="true"
          className="zentra-loader-halo absolute inset-0 -z-10 rounded-full bg-[#4FAEB2]/8 blur-2xl"
        />
      </div>

      {/* Wordmark + indicador textual */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-400">
          ZENTRA
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500">{label}</span>
          <span className="zentra-loader-dot inline-block h-1 w-1 rounded-full bg-[#4FAEB2]" />
          <span
            className="zentra-loader-dot inline-block h-1 w-1 rounded-full bg-[#4FAEB2]"
            style={{ animationDelay: "0.18s" }}
          />
          <span
            className="zentra-loader-dot inline-block h-1 w-1 rounded-full bg-[#4FAEB2]"
            style={{ animationDelay: "0.36s" }}
          />
        </div>
      </div>

      <style jsx>{`
        :global(.zentra-cursor-ne) {
          animation: zentraCursorNE 2200ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        :global(.zentra-cursor-sw) {
          animation: zentraCursorSW 2200ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        :global(.zentra-loader-halo) {
          animation: zentraHalo 2200ms ease-in-out infinite;
        }
        .zentra-loader-dot {
          animation: zentraDot 1300ms ease-in-out infinite;
        }
        /* Cursor superior: viaja hacia NE (top-right) y vuelve */
        @keyframes zentraCursorNE {
          0%,
          100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(10%, -10%);
          }
        }
        /* Cursor inferior: viaja hacia SW (bottom-left) y vuelve */
        @keyframes zentraCursorSW {
          0%,
          100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(-10%, 10%);
          }
        }
        @keyframes zentraHalo {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.28);
            opacity: 1;
          }
        }
        @keyframes zentraDot {
          0%,
          80%,
          100% {
            opacity: 0.25;
            transform: translateY(0);
          }
          40% {
            opacity: 1;
            transform: translateY(-2px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.zentra-cursor-ne),
          :global(.zentra-cursor-sw),
          :global(.zentra-loader-halo),
          .zentra-loader-dot {
            animation: none;
          }
        }
      `}</style>

      <span className="sr-only">Cargando contenido…</span>
    </div>
  );
}
