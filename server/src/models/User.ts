import { pgPool } from '../config/db';

/**
 * User — SQL-backed data layer (Supabase Postgres).
 *
 * Mirrors Supabase Auth users in the local database; the authoritative app
 * role lives here so admin-panel role changes take effect immediately
 * (Supabase JWTs only carry the role assigned at signup).
 */

export interface UserDoc {
  id: string;
  supabaseId: string;
  email: string;
  role: 'officer' | 'reviewer' | 'admin';
  name: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: any): UserDoc {
  return {
    id: String(row.id),
    supabaseId: row.supabase_id,
    email: row.email,
    role: row.role,
    name: row.name ?? null,
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requirePool() {
  if (!pgPool) throw new Error('Database not configured — set PG_CONNECTION_STRING');
  return pgPool;
}

export class User {
  static async findBySupabaseId(supabaseId: string): Promise<UserDoc | null> {
    const result = await requirePool().query(
      'SELECT * FROM users WHERE supabase_id = $1 LIMIT 1',
      [supabaseId],
    );
    return result.rows.length ? mapRow(result.rows[0]) : null;
  }

  static async findById(id: string): Promise<UserDoc | null> {
    const result = await requirePool().query('SELECT * FROM users WHERE id = $1::uuid LIMIT 1', [
      id,
    ]);
    return result.rows.length ? mapRow(result.rows[0]) : null;
  }

  static async create(data: {
    supabaseId: string;
    email: string;
    role?: 'officer' | 'reviewer' | 'admin';
    name?: string | null;
    lastLoginAt?: Date | null;
  }): Promise<UserDoc> {
    const result = await requirePool().query(
      `INSERT INTO users (supabase_id, email, role, name, last_login_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        data.supabaseId,
        data.email,
        data.role ?? 'officer',
        data.name ?? null,
        data.lastLoginAt ?? null,
      ],
    );
    return mapRow(result.rows[0]);
  }

  /** Insert-or-update by Supabase id (POST /api/auth/sync). */
  static async upsertBySupabaseId(data: {
    supabaseId: string;
    email: string;
    role: 'officer' | 'reviewer' | 'admin';
    lastLoginAt?: Date | null;
  }): Promise<UserDoc> {
    const result = await requirePool().query(
      `INSERT INTO users (supabase_id, email, role, last_login_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (supabase_id)
       DO UPDATE SET email = EXCLUDED.email,
                     role = EXCLUDED.role,
                     last_login_at = EXCLUDED.last_login_at,
                     updated_at = now()
       RETURNING *`,
      [data.supabaseId, data.email, data.role, data.lastLoginAt ?? new Date()],
    );
    return mapRow(result.rows[0]);
  }

  static async findByRoles(
    roles: Array<'officer' | 'reviewer' | 'admin'>,
  ): Promise<Array<Pick<UserDoc, 'id' | 'supabaseId'>>> {
    if (!roles.length) return [];
    const result = await requirePool().query(
      'SELECT id, supabase_id FROM users WHERE role = ANY($1)',
      [roles],
    );
    return result.rows.map((r: any) => ({ id: String(r.id), supabaseId: r.supabase_id }));
  }

  static async findAll(): Promise<UserDoc[]> {
    const result = await requirePool().query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows.map(mapRow);
  }

  static async updateRole(
    id: string,
    role: 'officer' | 'reviewer' | 'admin',
  ): Promise<UserDoc | null> {
    const result = await requirePool().query(
      `UPDATE users SET role = $2, updated_at = now() WHERE id = $1::uuid RETURNING *`,
      [id, role],
    );
    return result.rows.length ? mapRow(result.rows[0]) : null;
  }

  static async touchLastLogin(supabaseId: string): Promise<void> {
    await requirePool().query(
      `UPDATE users SET last_login_at = now(), updated_at = now() WHERE supabase_id = $1`,
      [supabaseId],
    );
  }
}

export default User;
