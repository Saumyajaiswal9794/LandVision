import { pgPool } from '../config/db';

/**
 * ReviewQueue — SQL-backed data layer (Supabase Postgres).
 * Documents waiting for (or in) human review.
 */

export interface ReviewQueueDoc {
  id: string;
  landRecordId: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'assigned' | 'completed';
  assignedTo: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: any): ReviewQueueDoc {
  return {
    id: String(row.id),
    landRecordId: String(row.land_record_id),
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to ?? null,
    reason: row.reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requirePool() {
  if (!pgPool) throw new Error('Database not configured — set PG_CONNECTION_STRING');
  return pgPool;
}

export class ReviewQueue {
  static async findOneOpen(landRecordId: string): Promise<ReviewQueueDoc | null> {
    const result = await requirePool().query(
      `SELECT * FROM review_queue
       WHERE land_record_id = $1::uuid AND status IN ('pending', 'assigned')
       LIMIT 1`,
      [landRecordId],
    );
    return result.rows.length ? mapRow(result.rows[0]) : null;
  }

  static async create(data: {
    landRecordId: string;
    priority?: 'low' | 'medium' | 'high';
    status?: 'pending' | 'assigned' | 'completed';
    assignedTo?: string | null;
    reason?: string | null;
  }): Promise<ReviewQueueDoc> {
    const result = await requirePool().query(
      `INSERT INTO review_queue (land_record_id, priority, status, assigned_to, reason)
       VALUES ($1::uuid, $2, $3, $4, $5) RETURNING *`,
      [
        data.landRecordId,
        data.priority ?? 'medium',
        data.status ?? 'pending',
        data.assignedTo ?? null,
        data.reason ?? null,
      ],
    );
    return mapRow(result.rows[0]);
  }

  static async findOpen(): Promise<ReviewQueueDoc[]> {
    const result = await requirePool().query(
      `SELECT * FROM review_queue
       WHERE status IN ('pending', 'assigned')
       ORDER BY CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
                created_at ASC`,
    );
    return result.rows.map(mapRow);
  }

  static async assign(id: string, assignedTo: string): Promise<ReviewQueueDoc | null> {
    const result = await requirePool().query(
      `UPDATE review_queue SET status = 'assigned', assigned_to = $2, updated_at = now()
       WHERE id = $1::uuid RETURNING *`,
      [id, assignedTo],
    );
    return result.rows.length ? mapRow(result.rows[0]) : null;
  }

  static async complete(id: string): Promise<ReviewQueueDoc | null> {
    const result = await requirePool().query(
      `UPDATE review_queue SET status = 'completed', updated_at = now()
       WHERE id = $1::uuid RETURNING *`,
      [id],
    );
    return result.rows.length ? mapRow(result.rows[0]) : null;
  }
}

export default ReviewQueue;
