/**
 * Diagnóstico Bot vs Inbox: lectura Postgres directa (sin SQL manual).
 *
 * Variables en .env.local:
 *   SUPABASE_DB_URL | DIRECT_URL | DATABASE_URL
 *   CHAT_DIAGNOSE_EMPRESA_ID (uuid, obligatorio)
 *   CHAT_DIAGNOSE_SCHEMA (default: zentra_erp)
 *
 * Uso: npx tsx scripts/diagnose-chat-bot-tab.ts
 */
import { config } from "dotenv";
import path from "node:path";
import pg from "pg";

config({ path: path.resolve(process.cwd(), ".env.local") });

const url =
  process.env.SUPABASE_DB_URL?.trim() ||
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL?.trim();
const empresaId = process.env.CHAT_DIAGNOSE_EMPRESA_ID?.trim();
const schema = (process.env.CHAT_DIAGNOSE_SCHEMA ?? "zentra_erp").trim();

async function main() {
  if (!url) {
    console.error("Falta SUPABASE_DB_URL, DIRECT_URL o DATABASE_URL");
    process.exit(1);
  }
  if (!empresaId) {
    console.error("Falta CHAT_DIAGNOSE_EMPRESA_ID en .env.local");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    const q = `
      SELECT
        c.id::text AS conversation_id,
        c.status::text,
        c.human_taken_over,
        c.flow_status::text,
        c.flow_code::text,
        c.active_flow_session_id::text,
        s.id::text AS session_row_id,
        s.status::text AS session_status,
        s.flow_code::text AS session_flow_code
      FROM ${schema}.chat_conversations c
      LEFT JOIN ${schema}.chat_flow_sessions s
        ON s.id = c.active_flow_session_id AND s.empresa_id = c.empresa_id
      WHERE c.empresa_id = $1::uuid
        AND c.status IN ('open', 'pending')
      ORDER BY c.last_message_at DESC NULLS LAST
      LIMIT 15
    `;
    const r = await client.query(q, [empresaId]);
    console.log(JSON.stringify({ schema, empresa_id: empresaId, rows: r.rows }, null, 2));

    const q2 = `
      SELECT flow_code::text, activo
      FROM ${schema}.chat_flows
      WHERE empresa_id = $1::uuid AND COALESCE(activo, false) = true
      ORDER BY flow_code
    `;
    const r2 = await client.query(q2, [empresaId]);
    console.log("active_flows:", r2.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
