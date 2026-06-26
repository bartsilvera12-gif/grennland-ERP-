import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Alias publico para la web de GreenLand: las rutas /api/public/greenland/*
  // sirven exactamente lo mismo que /api/public/alquiloya/* (mismas handlers,
  // mismo payload). Asi la web externa apunta a una URL coherente con el
  // branding sin tener que renombrar 12 archivos de rutas.
  async rewrites() {
    return [
      {
        source: "/api/public/greenland/:path*",
        destination: "/api/public/alquiloya/:path*",
      },
    ];
  },
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
  async headers() {
    return [
      // CORS abierto para los endpoints publicos del ERP. Permite que la
      // web estatica (cualquier origen, p. ej. greenlandpy.com) consuma
      // /api/public/* desde el browser sin ser bloqueada por la policy
      // del mismo origen.
      {
        source: "/api/public/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      // .jsx / .js / .css del sitio legacy: cache largo. Cada archivo lleva ?v=... en index.html,
      // así que cuando cambia el contenido cambia la URL y se invalida automáticamente.
      {
        source: "/alquiloya-legacy/:path*.(jsx|js|css)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400" },
        ],
      },
      // Assets (img/png/jpg/webp/svg/woff2): cache muy largo, son inmutables.
      {
        source: "/alquiloya-legacy/:path*.(png|jpg|jpeg|webp|svg|gif|ico|woff|woff2)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000, s-maxage=2592000, immutable" },
        ],
      },
      // Los .html del sitio legacy: NO cachear. Antes era max-age=300 +
      // stale-while-revalidate=86400 — eso dejaba el HTML viejo en el browser
      // hasta 5 min y en el CDN hasta 24h despues de cada deploy, asi que los
      // bumps de ?v=... en los <script src=> nunca llegaban al usuario y los
      // cambios "no aparecian" aunque estuvieran deployados. Con no-cache el
      // browser revalida con el server cada vez (304 si no cambio), mientras
      // que los .js siguen con cache largo via su ?v= propio.
      {
        source: "/alquiloya-legacy/:path*.html",
        headers: [
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
