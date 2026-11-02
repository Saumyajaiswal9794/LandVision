import { pgPool } from '../config/db';

/**
 * Notification — SQL-backed data layer (Supabase Postgres).
 * Per-user in-app notifications (review requested/completed, extraction status).
 */

export type NotificationType =
  | 'review_requested'
  | 'review_completed'
  | 'extraction_failed'
  | 'extraction_complete';

export interface NotificationDoc {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: any): NotificationDoc {
  return {
    id: String(row.id),
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requirePool() {
  if (!pgPool) throw new Error('Database not configured — set PG_CONNECTION_STRING');
  return pgPool;
}

export class Notification {
  static async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    read?: boolean;
    metadata?: unknown;
  }): Promise<NotificationDoc> {
    const result = await requirePool().query(
      `INSERT INTO notifications (user_id, type, title, message, read, metadata)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        data.userId,
        data.type,
        data.title,
        data.message,
        data.read ?? false,
        data.metadata ?? null,
      ],
    );
    return mapRow(result.rows[0]);
  }

  static async insertMany(
    docs: Array<{
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      read?: boolean;
      metadata?: unknown;
    }>,
  ): Promise<void> {
    if (!docs.length) return;
    const pool = requirePool();
    const values: unknown[] = [];
    const tuples = docs.map((d, i) => {
      const base = i * 6;
      values.push(d.userId, d.type, d.title, d.message, d.read ?? false, d.metadata ?? null);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    });
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, read, metadata)
       VALUES ${tuples.join(', ')}`,
      values,
    );
  }

  static async findByUser(userId: string, limit = 50): Promise<NotificationDoc[]> {
    const result = await requirePool().query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit],
    );
    return result.rows.map(mapRow);
  }

  static async markRead(id: string, userId: string): Promise<NotificationDoc | null> {
    const result = await requirePool().query(
      `UPDATE notifications SET read = TRUE, updated_at = now()
       WHERE id = $1::uuid AND user_id = $2 RETURNING *`,
      [id, userId],
    );
    return result.rows.length ? mapRow(result.rows[0]) : null;
  }

  static async markAllRead(userId: string): Promise<void> {
    await requirePool().query(
      `UPDATE notifications SET read = TRUE, updated_at = now()
       WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );
  }
}

export default Notification;
