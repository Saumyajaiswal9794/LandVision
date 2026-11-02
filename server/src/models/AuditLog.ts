import { pgPool } from '../config/db';

/**
 * AuditLog — SQL-backed data layer (Supabase Postgres).
 * One row per mutation performed through the API (see middleware/auditLogger).
 */

export interface AuditLogDoc {
  id: string;
  userId: string;
  userEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  timestamp: Date;
}

function mapRow(row: any): AuditLogDoc {
  return {
    id: String(row.id),
    userId: row.user_id,
    userEmail: row.user_email ?? null,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id ?? null,
    ip: row.ip ?? null,
    userAgent: row.user_agent ?? null,
    metadata: row.metadata ?? null,
    timestamp: row.timestamp,
  };
}

function requirePool() {
  if (!pgPool) throw new Error('Database not configured — set PG_CONNECTION_STRING');
  return pgPool;
}

export class AuditLog {
  static async create(data: {
    userId: string;
    userEmail?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    metadata?: unknown;
  }): Promise<AuditLogDoc> {
    const result = await requirePool().query(
      `INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, ip, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        data.userId,
        data.userEmail ?? null,
        data.action,
        data.resourceType,
        data.resourceId ?? null,
        data.ip ?? null,
        data.userAgent ?? null,
        data.metadata ?? null,
      ],
    );
    return mapRow(result.rows[0]);
  }

  static async findRecent(limit = 100): Promise<AuditLogDoc[]> {
    const result = await requirePool().query(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1',
      [limit],
    );
    return result.rows.map(mapRow);
  }
}

export default AuditLog;
