"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Mail, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api/fetch-with-supabase-session";
import { invalidateCachedFetch } from "@/lib/api/cached-session-fetch";
import { notify } from "@/lib/ui/dialogs";

type Usuario = {
  nombre: string | null;
  rol: string | null;
  email: string | null;
  avatar_url?: string | null;
};

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;

function clean(v: string | null | undefined): string {
  return (v ?? "").trim();
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
    operador: "Operador",
    usuario: "Usuario",
  };
  if (labels[r]) return labels[r];
  if (!r) return "Usuario";
  return r
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default function PerfilPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiFetch("/api/usuarios/me", { cache: "no-store" });
        const json = (await r.json().catch(() => ({}))) as { usuario?: Usuario };
        if (alive) setUsuario(json.usuario ?? null);
      } catch {
        if (alive) setUsuario(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-subir el mismo archivo
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      notify({ tone: "warning", message: "Formato no válido. Usá una imagen JPG, PNG o WEBP." });
      return;
    }
    if (file.size > MAX_BYTES) {
      notify({ tone: "warning", message: "La imagen supera el máximo de 4 MB." });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await apiFetch("/api/usuarios/me/avatar", { method: "POST", body: fd });
      const data = (await r.json().catch(() => ({}))) as { success?: boolean; avatar_url?: string; error?: string };
      if (!r.ok || !data.success) throw new Error(data.error || `HTTP ${r.status}`);
      setUsuario((prev) => (prev ? { ...prev, avatar_url: data.avatar_url } : prev));
      // Invalida la caché del header para que el avatar se actualice sin recargar sesión.
      invalidateCachedFetch("/api/usuarios/me");
      notify({ tone: "success", message: "Foto de perfil actualizada." });
    } catch (err) {
      notify({ tone: "danger", message: `No pudimos subir la foto. ${err instanceof Error ? err.message : ""}` });
    } finally {
      setUploading(false);
    }
  }

  const nombre = clean(usuario?.nombre);
  const email = clean(usuario?.email);
  const displayName = nombre || email || "Usuario";
  const avatarUrl = clean(usuario?.avatar_url);
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-[#0F172A]">Mi perfil</h1>
        <p className="mt-1 text-sm text-[#475569]">Tu información de cuenta y tu foto de perfil en el ERP.</p>
      </header>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-5">
            <div className="h-24 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#0EA5E9] text-3xl font-bold text-white ring-2 ring-white shadow">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden>{initial}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                title={avatarUrl ? "Cambiar foto" : "Subir foto"}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#0058A5] text-white shadow transition-colors hover:bg-[#004B8F] disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onPick}
                className="hidden"
              />
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="truncate text-lg font-semibold text-[#0F172A]">{displayName}</p>
              <div className="mt-2 flex flex-col items-center gap-1.5 text-sm text-[#475569] sm:items-start">
                {email ? (
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" /> {email}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-400" /> {roleLabel(usuario?.rol)}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-[#94A3B8]">
            Formatos aceptados: JPG, PNG o WEBP. Tamaño máximo 4 MB. Para cambiar tu nombre, email o rol, contactá a un
            administrador desde Configuración de usuarios.
          </p>
        </div>
      )}
    </div>
  );
}
