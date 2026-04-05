/**
 * CDC (atributo Id del tDE): 44 caracteres numéricos según esquema SIFEN v150.
 * Base de 43 dígitos + 1 dígito verificador (módulo 11, pesos 2–7 cíclicos de derecha a izquierda).
 * Referencia de estructura: muestra oficial kmee/sifen (factura_electronica.xml).
 */
import { createHash } from "node:crypto";

const I_TI_DE_FE = "01"; // Factura electrónica (iTiDE=1, 2 dígitos)

export function padDigits(value: string | number, len: number): string {
  const s = String(value).replace(/\D/g, "");
  if (s.length >= len) return s.slice(-len);
  return s.padStart(len, "0").slice(-len);
}

/** dNumTim: 8 dígitos */
export function normalizarNumeroTimbrado(timbrado: string): string {
  return padDigits(timbrado.replace(/\D/g, ""), 8);
}

/** dEst / dPunExp: 3 dígitos */
export function normalizarCodigoTres(val: string): string {
  return padDigits(val.replace(/\D/g, ""), 3);
}

/** dNumDoc: 7 dígitos desde número de factura ERP */
export function normalizarNumeroDocumentoSifen(numeroFactura: string): string {
  const d = numeroFactura.replace(/\D/g, "");
  if (!d) return "0000001";
  return padDigits(d, 7);
}

/** Fecha AAAAMMDD para tramo CDC (emisión DE). */
export function fechaEmisionCdc(fechaIso: string): string {
  const t = fechaIso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const da = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${mo}${da}`;
  }
  throw new Error(`Fecha de emisión inválida para CDC: ${fechaIso}`);
}

/**
 * Separa cuerpo del RUC (sin DV) y dígito verificador, para nodos XML (sin relleno forzado).
 */
export function splitRucParaXml(rucRaw: string): { cuerpo: string; dDV: string } {
  const d = rucRaw.replace(/\D/g, "");
  if (d.length < 2) {
    throw new Error("RUC demasiado corto");
  }
  const dDV = d.slice(-1);
  const cuerpo = d.slice(0, -1);
  if (cuerpo.length < 1 || cuerpo.length > 8) {
    throw new Error("Longitud de RUC incompatible con SIFEN");
  }
  return { cuerpo, dDV };
}

/** 11 dígitos pseudoaleatorios para completar la base CDC (43 = 32 fijos + 11). */
export function onceDigitosAleatorios(): string {
  const h = createHash("sha256").update(`${Date.now()}-${Math.random()}-${process.hrtime.bigint()}`).digest("hex");
  let n = "";
  for (let i = 0; i < h.length && n.length < 11; i++) {
    const c = h[i]!;
    const v = parseInt(c, 16);
    n += String(v % 10);
  }
  return n.padStart(11, "0").slice(-11);
}

export function digitoVerificadorModulo11Base43(base43: string): string {
  if (!/^\d{43}$/.test(base43)) {
    throw new Error(`La base CDC debe tener 43 dígitos; recibido ${base43.length}`);
  }
  const pesos = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = base43.length - 1, p = 0; i >= 0; i--, p++) {
    sum += parseInt(base43[i]!, 10) * pesos[p % 6]!;
  }
  const r = sum % 11;
  return String(r < 2 ? 0 : 11 - r);
}

export interface CdcFacturaElectronicaInput {
  iTiDE: string; // "1" normalmente
  dRucEm: string;
  dDVEmi: string;
  dEst: string;
  dPunExp: string;
  dNumDoc: string;
  /** AAAAMMDD */
  fechaEmision: string;
}

/**
 * Arma los 43 dígitos previos al DV y devuelve CDC completo (44) + DV suelto (igual al último dígito del CDC).
 */
export function generarCdcFacturaElectronica(inp: CdcFacturaElectronicaInput): { cdc: string; dDVId: string; base43: string } {
  const iTiDep = padDigits(inp.iTiDE.replace(/\D/g, ""), 2);
  const ruc = padDigits(inp.dRucEm.replace(/\D/g, ""), 8);
  const dvE = inp.dDVEmi.replace(/\D/g, "").slice(-1) || "0";
  const est = normalizarCodigoTres(inp.dEst);
  const pe = normalizarCodigoTres(inp.dPunExp);
  const nd = normalizarNumeroDocumentoSifen(inp.dNumDoc);
  const f = inp.fechaEmision.replace(/\D/g, "");
  if (f.length !== 8) throw new Error(`fechaEmision CDC debe ser AAAAMMDD (8 dígitos): ${inp.fechaEmision}`);
  const suf = onceDigitosAleatorios();
  const base43 = `${iTiDep}${ruc}${dvE}${est}${pe}${nd}${f}${suf}`;
  if (base43.length !== 43) {
    throw new Error(`Longitud base CDC inesperada: ${base43.length}`);
  }
  const dv = digitoVerificadorModulo11Base43(base43);
  const cdc = `${base43}${dv}`;
  return { cdc, dDVId: dv, base43 };
}

export { I_TI_DE_FE };
