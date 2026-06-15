/**
 * Aplica las migraciones PENDIENTES de supabase/migrations/*.sql en orden
 * cronológico (por su prefijo timestamp), registrando cada una en una tabla de
 * control para no re-ejecutarlas en el próximo deploy.
 *
 * Tabla de control: public.neura_migrations (filename PK, applied_at).
 *
 * Lee SUPABASE_DB_URL desde .env.local (igual que apply-migration-file-pg.cjs).
 *
 * Uso:
 *   node scripts/apply-pending-migrations.cjs              → aplica las pendientes
 *   node scripts/apply-pending-migrations.cjs --dry-run    → lista las pendientes, no ejecuta
 *   node scripts/apply-pending-migrations.cjs --baseline   → marca TODAS las actuales como aplicadas
 *                                                            SIN ejecutarlas (usar UNA vez en una DB
 *                                                            que ya está al día, para sembrar el control)
 *
 * Recomendado: en una DB existente y al día, correr primero `--baseline` una vez;
 * luego, en cada deploy, correr el comando sin flags para aplicar solo lo nuevo.
 */
const fs = require("fs");
const path = require("path");
const { config } = require("dotenv");
const pg = require("pg");

config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.SUPABASE_DB_URL?.trim();
if (!url) {
  console.error("Falta SUPABASE_DB_URL en .env.local");
  process.exit(2);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BASELINE = args.includes("--baseline");

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`No existe ${MIGRATIONS_DIR}`);
    process.exit(2);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // prefijo timestamp → orden cronológico
}

async function main() {
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.neura_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const all = listMigrationFiles();
    const { rows } = await client.query("SELECT filename FROM public.neura_migrations");
    const applied = new Set(rows.map((r) => r.filename));
    const pending = all.filter((f) => !applied.has(f));

    if (BASELINE) {
      for (const f of all) {
        await client.query(
          "INSERT INTO public.neura_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
          [f]
        );
      }
      console.log(`[baseline] ${all.length} migraciones marcadas como aplicadas (sin ejecutar).`);
      return;
    }

    if (pending.length === 0) {
      console.log("Sin migraciones pendientes. La base está al día.");
      return;
    }

    console.log(`Pendientes (${pending.length}):`);
    pending.forEach((f) => console.log("  - " + f));

    if (DRY_RUN) {
      console.log("\n[dry-run] No se ejecutó nada.");
      return;
    }

    for (const f of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
      process.stdout.write(`Aplicando ${f} ... `);
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO public.neura_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
          [f]
        );
        console.log("OK");
      } catch (e) {
        console.log("FALLÓ");
        console.error(`\nError en ${f}:\n${e.message}\n`);
        console.error("Se detiene la corrida. Corregí el problema y volvé a ejecutar (las ya aplicadas no se repiten).");
        process.exit(1);
      }
    }
    console.log(`\nListo. ${pending.length} migración(es) aplicada(s).`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
