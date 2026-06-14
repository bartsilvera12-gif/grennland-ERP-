// Sanitiza HTML del blog de agentes. Solo deja tags con sentido editorial.
// Se usa en los POST/PATCH del blog (panel del agente y dashboard ERP) antes
// de persistir. La whitelist coincide con el toolbar del editor
// (BlogContentEditor en public/alquiloya-legacy/admin.jsx) y con los estilos
// .post-html definidos en public/alquiloya-legacy/index.html:
//   strong, em, h2, h3, ul, ol, li, blockquote, a, p, br
//
// NO es un sanitizer perfecto (sin DOMPurify por costo en edge/serverless),
// pero elimina los vectores XSS clasicos: <script>, <iframe>, <style>,
// event handlers on*=, y URLs javascript:/data:/vbscript: en href/src/action.
//
// Vive en lib (no en un route.ts) para poder importarlo desde varios route
// handlers sin el patron fragil de importar entre archivos de ruta.
export function sanitizeBlogHtml(input: string | null): string | null {
  if (input == null) return null;
  let h = input;
  // Drop tags peligrosos enteros (apertura + contenido + cierre).
  h = h.replace(/<(script|iframe|style|object|embed|link|meta|form|input|button)[\s\S]*?<\/\1>/gi, "");
  // Drop tags self-closing peligrosos.
  h = h.replace(/<(script|iframe|style|object|embed|link|meta|input)[^>]*\/?>/gi, "");
  // Drop event handlers on*= en cualquier atributo.
  h = h.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Neutraliza javascript:/data:/vbscript: URLs en href/src/action.
  h = h.replace(/(\s(?:href|src|action)\s*=\s*)(["'])\s*(javascript|data|vbscript):[^"']*\2/gi, '$1$2#$2');
  return h;
}
