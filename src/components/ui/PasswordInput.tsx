"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Input de contraseña con boton "ojito" para mostrar/ocultar.
 * Reusable en todos los flujos: login ERP, portales publicos,
 * forms de crear acceso, alta de usuarios, etc.
 *
 * Props pasan al <input> nativo. className aplica al input.
 * El boton ojito se posiciona absolute dentro del wrapper.
 */
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  className?: string;
  /** Para cuando el boton "ojito" tape contenido del input — default true. */
  withRightPadding?: boolean;
};

export default function PasswordInput({
  className,
  withRightPadding = true,
  ...rest
}: Props) {
  const [show, setShow] = useState(false);
  const pad = withRightPadding ? "pr-10" : "";
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={`${className ?? ""} ${pad}`.trim()}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
