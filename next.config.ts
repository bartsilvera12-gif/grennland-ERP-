import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Web pública legacy de AlquiloYa servida desde /public/alquiloya-legacy/
      // El index.html no se resuelve solo como ruta; redirigimos /publico → archivo estático.
      {
        source: "/publico",
        destination: "/alquiloya-legacy/index.html",
        permanent: false,
      },
      // Portal público de acceso para agentes/publicadores. Es un HTML
      // estático aislado del layout ERP (sin sidebar, sin auth).
      {
        source: "/portal-agentes",
        destination: "/alquiloya-legacy/portal-agentes.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
