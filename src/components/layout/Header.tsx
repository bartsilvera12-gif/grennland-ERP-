"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { signOut } from "@/lib/auth";

type HeaderUsuario = {
  nombre: string | null;
  rol: string | null;
  email: string | null;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function roleLabel(rol: string | null | undefined): string {
  const r = clean(rol).toLowerCase();
  const labels: Record<string, string> = {
    admin: "Admin",
    administrador: "Admin",
    super_admin: "Super admin",
    supervisor: "Supervisor",
    vendedor: "Vendedor",
    asesor: "Asesor",
    comercial: "Comercial",
    "asesor comercial": "Asesor comercial",
    usuario: "Usuario",
  };
  if (labels[r]) return labels[r];
  if (!r) return "Usuario";
  return r
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function Header() {
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [usuario, setUsuario] = useState<HeaderUsuario | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadUsuario() {
      try {
        const res = await fetchWithSupabaseSession("/api/usuarios/me", { cache: "no-store" });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const json = (await res.json()) as { usuario?: HeaderUsuario };
        if (alive) setUsuario(json.usuario ?? null);
      } catch {
        if (alive) setUsuario(null);
      }
    }
    void loadUsuario();
    return () => {
      alive = false;
    };
  }, []);

  const nombreReal = clean(usuario?.nombre);
  const fallbackEmail = clean(usuario?.email);
  const displayName = nombreReal || fallbackEmail || "Usuario";
  const dropdownName = nombreReal || "Usuario";
  const avatarInitial = (nombreReal || fallbackEmail || "Usuario").charAt(0).toUpperCase();
  const displayRole = roleLabel(usuario?.rol);

  return (
    <header
      id="neura-header"
      className="z-40 flex h-16 shrink-0 items-center justify-end gap-3 border-b border-[color:var(--zentra-sidebar-border)] bg-[color:var(--zentra-sidebar)] px-4 sm:px-6 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.25)]"
    >
      <div className="flex items-center gap-2">
        {/* Notificaciones */}
        <button
          type="button"
          className="relative rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-200 shadow-sm transition-colors hover:border-[#4FAEB2]/50 hover:bg-white/[0.08] hover:text-white"
          aria-label="Notificaciones"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#4FAEB2] px-1 text-[10px] font-bold text-white shadow-[0_0_0_2px_var(--zentra-sidebar)]">
            0
          </span>
        </button>

        {/* Avatar + menú usuario */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 transition-colors hover:border-[#4FAEB2]/50 hover:bg-white/[0.08]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4FAEB2] to-[#3F8E91] text-white shadow-[0_0_0_2px_rgba(79,174,178,0.25)] ring-1 ring-white/15">
              <span className="text-sm font-bold tracking-tight">{avatarInitial}</span>
            </div>
            <div className="hidden text-left sm:block">
              <p className="max-w-[180px] truncate text-sm font-semibold tracking-tight text-white">{displayName}</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#4FAEB2]">{displayRole}</p>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-300 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className={`absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-[#0B3A3D]/20 ring-1 ring-[#4FAEB2]/15 ${
              userMenuOpen ? "block" : "hidden"
            }`}
          >
            <div className="relative border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#4FAEB2] via-[#4FAEB2]/80 to-[#4FAEB2]/40"
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4FAEB2]">Sesión</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">{dropdownName}</p>
              <p className="truncate text-xs text-slate-500">{displayRole}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.push("/login");
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-[#4FAEB2]/10 hover:text-[#3F8E91]"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
