#!/usr/bin/env node
/**
 * Precompila los .jsx de la web pública legacy (public/alquiloya-legacy/*.jsx)
 * a JS plano usando esbuild, ANTES del `next build`.
 *
 * Por qué: index.html cargaba @babel/standalone (~2.9MB) y transpilaba ~517KB
 * de JSX EN EL NAVEGADOR en cada visita, bloqueando el hilo principal varios
 * segundos en celular. Precompilando acá, el navegador recibe JS listo para
 * ejecutar: cero Babel, cero transpilación en runtime.
 *
 * Importante sobre el patrón de globals:
 * Los archivos legacy NO usan import/export. Comparten símbolos vía
 * `Object.assign(window, { ... })` y los leen como globals. Por eso:
 *   - Transformamos JSX → React.createElement SIN envolver en módulos
 *     (transform API, no bundle).
 *   - Solo minificamos whitespace/comentarios (minifyWhitespace). NO
 *     renombramos identificadores ni reescribimos sintaxis, para no romper
 *     el binding global entre archivos.
 *
 * Salida: public/alquiloya-legacy/build/<nombre>.js (gitignored, regenerado
 * en cada deploy).
 */
const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const LEGACY_DIR = path.join(__dirname, "..", "public", "alquiloya-legacy");
const OUT_DIR = path.join(LEGACY_DIR, "build");

function main() {
  if (!fs.existsSync(LEGACY_DIR)) {
    console.error(`[build-legacy-jsx] No existe ${LEGACY_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jsxFiles = fs
    .readdirSync(LEGACY_DIR)
    .filter((f) => f.endsWith(".jsx"))
    .sort();

  if (jsxFiles.length === 0) {
    console.warn("[build-legacy-jsx] No se encontraron .jsx — nada que compilar.");
    return;
  }

  let totalIn = 0;
  let totalOut = 0;

  for (const file of jsxFiles) {
    const srcPath = path.join(LEGACY_DIR, file);
    const code = fs.readFileSync(srcPath, "utf8");
    const result = esbuild.transformSync(code, {
      loader: "jsx",
      jsx: "transform",
      jsxFactory: "React.createElement",
      jsxFragment: "React.Fragment",
      // Solo whitespace/comentarios: cero renombrado de identificadores para
      // no romper el patrón de globals compartidos entre archivos.
      minifyWhitespace: true,
      minifyIdentifiers: false,
      minifySyntax: false,
      target: "es2018",
      sourcemap: false,
    });
    const outName = file.replace(/\.jsx$/, ".js");
    const outPath = path.join(OUT_DIR, outName);
    fs.writeFileSync(outPath, result.code, "utf8");
    totalIn += Buffer.byteLength(code);
    totalOut += Buffer.byteLength(result.code);
    console.log(
      `[build-legacy-jsx] ${file} → build/${outName} ` +
        `(${(Buffer.byteLength(code) / 1024).toFixed(1)}KB → ${(Buffer.byteLength(result.code) / 1024).toFixed(1)}KB)`
    );
  }

  // vivio-sendpulse.js ya es JS plano (no JSX). Lo copiamos a build/ para que
  // index.html cargue TODO desde build/ de forma uniforme.
  const vivio = path.join(LEGACY_DIR, "vivio-sendpulse.js");
  if (fs.existsSync(vivio)) {
    const out = esbuild.transformSync(fs.readFileSync(vivio, "utf8"), {
      loader: "js",
      minifyWhitespace: true,
      target: "es2018",
    });
    fs.writeFileSync(path.join(OUT_DIR, "vivio-sendpulse.js"), out.code, "utf8");
    console.log("[build-legacy-jsx] vivio-sendpulse.js → build/vivio-sendpulse.js");
  }

  console.log(
    `[build-legacy-jsx] OK — ${jsxFiles.length} archivos. ` +
      `Total ${(totalIn / 1024).toFixed(0)}KB → ${(totalOut / 1024).toFixed(0)}KB ` +
      `(se elimina además ~2.9MB de @babel/standalone del navegador).`
  );
}

main();
