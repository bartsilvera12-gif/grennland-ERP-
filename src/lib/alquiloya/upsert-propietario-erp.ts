import "server-only";
import type { PoolClient } from "pg";
import { getClientSchema } from "@/lib/env/instance-mode";

const SCHEMA = getClientSchema();

/**
 * Resuelve / actualiza / crea la fila de alquiloya.propietarios que se va a
 * vincular a una propiedad creada o editada desde el ERP.
 *
 * Reglas (matchean el flujo publico /api/public/alquiloya/propiedades):
 *  - Si `propietario_id` viene set, usa esa fila (y opcionalmente actualiza
 *    los campos que llegaron â€” UPDATE COALESCE).
 *  - Si no, busca por email; despues por telefono.
 *  - Si no encuentra nada y hay nombre, crea una fila nueva con estado
 *    'pendiente'.
 *  - Si no hay datos suficientes (sin id, sin nombre, sin email, sin
 *    telefono) devuelve null y la propiedad queda sin propietario linkeado.
 *
 * Importante: hace `ALTER TABLE ... ADD COLUMN IF NOT EXISTS telefono_contacto`
 * antes del INSERT para soportar DBs que no corrieron la migration 20260704.
 */
export type UpsertPropietarioInput = {
  empresaId: string;
  propietario_id?: string | null;
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  telefono_contacto?: string | null;
  documento?: string | null;
  observaciones?: string | null;
};

export async function upsertPropietarioErp(
  client: PoolClient,
  input: UpsertPropietarioInput
): Promise<string | null> {
  const {
    empresaId,
    propietario_id,
    nombre,
    email,
    telefono,
    telefono_contacto,
    documento,
    observaciones,
  } = input;

  // Bootstrap idempotente â€” la migration 20260704 puede no estar en prod.
  await client.query(
    `ALTER TABLE "${SCHEMA}"."propietarios"
       ADD COLUMN IF NOT EXISTS telefono_contacto text`
  );

  // 1) Si vino propietario_id (vino del selector), respetamos ese vinculo.
  if (propietario_id) {
    // UPDATE COALESCE: solo pisamos columnas con valores no nulos del payload.
    await client.query(
      `UPDATE "${SCHEMA}"."propietarios"
          SET nombre            = COALESCE($2, nombre),
              email             = COALESCE($3, email),
              telefono          = COALESCE($4, telefono),
              telefono_contacto = COALESCE($5, telefono_contacto),
              documento         = COALESCE($6, documento),
              observaciones     = COALESCE($7, observaciones),
              updated_at        = now()
        WHERE id = $1::uuid AND empresa_id = $8::uuid`,
      [
        propietario_id,
        nombre,
        email,
        telefono,
        telefono_contacto,
        documento,
        observaciones,
        empresaId,
      ]
    );
    return propietario_id;
  }

  // 2) Lookup por email.
  if (email) {
    const r = await client.query<{ id: string }>(
      `SELECT id FROM "${SCHEMA}"."propietarios"
        WHERE empresa_id = $1::uuid AND lower(email) = lower($2) LIMIT 1`,
      [empresaId, email]
    );
    if (r.rows[0]) {
      const id = r.rows[0].id;
      await client.query(
        `UPDATE "${SCHEMA}"."propietarios"
            SET nombre            = COALESCE($2, nombre),
                telefono          = COALESCE($3, telefono),
                telefono_contacto = COALESCE($4, telefono_contacto),
                documento         = COALESCE($5, documento),
                observaciones     = COALESCE($6, observaciones),
                updated_at        = now()
          WHERE id = $1::uuid`,
        [id, nombre, telefono, telefono_contacto, documento, observaciones]
      );
      return id;
    }
  }

  // 3) Lookup por telefono.
  if (telefono) {
    const r = await client.query<{ id: string }>(
      `SELECT id FROM "${SCHEMA}"."propietarios"
        WHERE empresa_id = $1::uuid AND telefono = $2 LIMIT 1`,
      [empresaId, telefono]
    );
    if (r.rows[0]) {
      const id = r.rows[0].id;
      await client.query(
        `UPDATE "${SCHEMA}"."propietarios"
            SET nombre            = COALESCE($2, nombre),
                email             = COALESCE($3, email),
                telefono_contacto = COALESCE($4, telefono_contacto),
                documento         = COALESCE($5, documento),
                observaciones     = COALESCE($6, observaciones),
                updated_at        = now()
          WHERE id = $1::uuid`,
        [id, nombre, email, telefono_contacto, documento, observaciones]
      );
      return id;
    }
  }

  // 4) Crear nuevo si hay nombre.
  if (nombre) {
    const r = await client.query<{ id: string }>(
      `INSERT INTO "${SCHEMA}"."propietarios" (
         empresa_id, nombre, email, telefono, telefono_contacto,
         documento, estado, activo, observaciones
       )
       VALUES ($1::uuid, $2, $3, $4, $5, $6, 'pendiente', true, $7)
       RETURNING id`,
      [empresaId, nombre, email, telefono, telefono_contacto, documento, observaciones]
    );
    return r.rows[0]?.id ?? null;
  }

  return null;
}
