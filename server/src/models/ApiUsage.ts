import { pgPool } from '../config/db';

/**
 * ApiUsage — SQL-backed data layer (Supabase Postgres).
 * One row per AI (Gemini) call, for the admin usage/cost dashboard.
 */

export interface ApiUsageDoc {
  id: string;
  userId: string | null;
  documentId: string | null;
  modelName: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cost: number | null;
  operation: string;
  timestamp: Date;
}

function mapRow(row: any): ApiUsageDoc {
  return {
    id: String(row.id),
    userId: row.user_id ?? null,
    documentId: row.document_id ?? null,
    modelName: row.model_name,
    promptTokens: row.prompt_tokens ?? null,
    completionTokens: row.completion_tokens ?? null,
    totalTokens: row.total_tokens ?? null,
    cost: row.cost != null ? Number(row.cost) : null,
    operation: row.operation,
    timestamp: row.timestamp,
  };
}

function requirePool() {
  if (!pgPool) throw new Error('Database not configured — set PG_CONNECTION_STRING');
  return pgPool;
}

export class ApiUsage {
  static async create(data: {
    userId?: string | null;
    documentId?: string | null;
    modelName: string;
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    cost?: number | null;
    operation: string;
  }): Promise<ApiUsageDoc> {
    const result = await requirePool().query(
      `INSERT INTO api_usage (user_id, document_id, model_name, prompt_tokens, completion_tokens, total_tokens, cost, operation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        data.userId ?? null,
        data.documentId ?? null,
        data.modelName,
        data.promptTokens ?? null,
        data.completionTokens ?? null,
        data.totalTokens ?? null,
        data.cost ?? null,
        data.operation,
      ],
    );
    return mapRow(result.rows[0]);
  }

  static async findRecent(limit = 100): Promise<ApiUsageDoc[]> {
    const result = await requirePool().query(
      'SELECT * FROM api_usage ORDER BY timestamp DESC LIMIT $1',
      [limit],
    );
    return result.rows.map(mapRow);
  }
}

export default ApiUsage;
