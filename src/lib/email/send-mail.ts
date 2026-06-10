import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envío de email transaccional via SMTP.
 *
 * Variables de entorno (Coolify / .env.local):
 *   SMTP_HOST       smtp.hostinger.com
 *   SMTP_PORT       465  (SSL) o 587 (TLS)
 *   SMTP_USER       no-reply@alquiloya.com.py
 *   SMTP_PASS       <password del buzon>
 *   SMTP_FROM_NAME  AlquiloYa
 *   SMTP_FROM_EMAIL no-reply@alquiloya.com.py  (default = SMTP_USER)
 *
 * Si las variables no estan seteadas, sendMail devuelve { sent: false, reason }
 * sin tirar excepcion, asi el caller puede caer al flujo manual (mostrar la
 * password en el modal del ERP).
 */

let cachedTransporter: Transporter | null = null;
let cachedKey: string | null = null;

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const portRaw = process.env.SMTP_PORT?.trim();
  if (!host || !user || !pass) return null;
  const port = portRaw ? Number(portRaw) : 465;
  if (!Number.isFinite(port)) return null;
  const key = `${host}|${port}|${user}|${pass.length}`;
  if (cachedTransporter && cachedKey === key) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // SSL en 465; TLS-STARTTLS en 587/25
    auth: { user, pass },
  });
  cachedKey = key;
  return cachedTransporter;
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type SendMailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: string };

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, reason: "SMTP_HOST/SMTP_USER/SMTP_PASS no configurados" };
  }
  const fromName = (process.env.SMTP_FROM_NAME ?? "AlquiloYa").trim();
  const fromEmail = (process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? "").trim();
  if (!fromEmail) return { sent: false, reason: "SMTP_FROM_EMAIL/SMTP_USER vacío" };
  try {
    const info = await transporter.sendMail({
      from: { name: fromName, address: fromEmail },
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html),
      replyTo: input.replyTo,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn("[sendMail] error:", reason);
    return { sent: false, reason };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
