import { pgPool } from '../config/db';

/**
 * LandRecord — SQL-backed data layer (Supabase Postgres).
 *
 * This replaced the previous Mongoose model when the app moved to a
 * Supabase-only datastore. The public surface (findById / find / findOne /
 * `new LandRecord(data)` + save / insertMany / deleteAll) is intentionally
 * close to the old Mongoose API so controllers change minimally; nested
 * payloads (extractedFields, validationResults, …) are stored as JSONB and
 * round-trip as plain JS objects, keeping API response shapes identical.
 *
 * Row mapping: snake_case columns ⇄ camelCase document fields, plus an `_id`
 * string alias (the old Mongo id field used throughout the controllers).
 */

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

const COLUMNS: Record<string, string> = {
  id: 'id',
  filename: 'filename',
  uploadedBy: 'uploaded_by',
  storagePath: 'storage_path',
  storageUrl: 'storage_url',
  documentId: 'document_id',
  rowIndex: 'row_index',
  pageNo: 'page_no',
  village: 'village',
  district: 'district',
  tehsil: 'tehsil',
  state: 'state',
  khataNumber: 'khata_number',
  khasraNumber: 'khasra_number',
  khatoniNumber: 'khatoni_number',
  subSurveyNumber: 'sub_survey_number',
  fatherOrHusbandName: 'father_or_husband_name',
  remarks: 'remarks',
  owners: 'owners',
  coOwners: 'co_owners',
  mutationHistory: 'mutation_history',
  areaTotal: 'area_total',
  areaUnit: 'area_unit',
  extractedFields: 'extracted_fields',
  extractionSource: 'extraction_source',
  legacyExtractedFields: 'legacy_extracted_fields',
  confidenceScore: 'confidence_score',
  validationFlags: 'validation_flags',
  validationResults: 'validation_results',
  lowConfidenceFields: 'low_confidence_fields',
  status: 'status',
  extractionError: 'extraction_error',
  reviewedBy: 'reviewed_by',
  reviewedAt: 'reviewed_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const WRITABLE_KEYS = Object.keys(COLUMNS).filter((k) => k !== 'id' && k !== 'createdAt');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requirePool() {
  if (!pgPool) {
    throw new Error('Database not configured — set PG_CONNECTION_STRING (Supabase Postgres or local docker PostGIS)');
  }
  return pgPool;
}

function mapRow(row: any): LandRecordDoc {
  if (!row) return row;
  const doc: any = {};
  for (const [camel, snake] of Object.entries(COLUMNS)) {
    doc[camel] = row[snake] ?? null;
  }
  // Mongo-era aliases used throughout the controllers.
  doc._id = String(row.id);
  doc.id = String(row.id);
  return doc as LandRecordDoc;
}

// ---------------------------------------------------------------------------
// Filter translation (the simple Mongo-style filters used by the app)
// ---------------------------------------------------------------------------

function translateFilter(filter: Record<string, unknown>): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const push = (fragment: string, value: unknown) => {
    params.push(value);
    clauses.push(fragment.replace('?', `$${params.length}`));
  };

  for (const [rawKey, rawValue] of Object.entries(filter || {})) {
    const key = rawKey === '_id' ? 'id' : rawKey;
    const column = COLUMNS[key];
    if (!column) throw new Error(`Unsupported LandRecord filter key: ${rawKey}`);

    if (rawValue === null) {
      clauses.push(`${column} IS NULL`);
      continue;
    }
    if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      for (const [op, opValue] of Object.entries(rawValue as Record<string, unknown>)) {
        if (op === '$ne') {
          if (opValue === null) clauses.push(`${column} IS NOT NULL`);
          else push(`${column} <> ?`, opValue);
        } else if (op === '$in') {
          const values = opValue as unknown[];
          if (values.length === 0) {
            clauses.push('FALSE');
          } else {
            const placeholders = values.map((v) => {
              params.push(v);
              return `$${params.length}`;
            });
            clauses.push(`${column} IN (${placeholders.join(', ')})`);
          }
        } else if (op === '$exists') {
          clauses.push(opValue ? `${column} IS NOT NULL` : `${column} IS NULL`);
        } else {
          throw new Error(`Unsupported LandRecord filter operator: ${op}`);
        }
      }
      continue;
    }
    push(`${column} = ?`, rawValue);
  }

  return { where: clauses.length ? clauses.join(' AND ') : 'TRUE', params };
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function pickWritable(doc: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of WRITABLE_KEYS) {
    if (doc[key] !== undefined) out[key] = doc[key];
  }
  return out;
}

function toColumnParams(data: Record<string, unknown>): { cols: string[]; params: unknown[] } {
  const cols: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    const column = COLUMNS[key];
    if (!column || value === undefined) continue;
    cols.push(column);
    // node-postgres serialises plain objects to JSON for JSONB columns but
    // NOT arrays (they'd be sent as Postgres array literals) — stringify
    // both explicitly so nested payloads round-trip correctly.
    params.push(
      Array.isArray(value) || (value !== null && typeof value === 'object' && !(value instanceof Date))
        ? JSON.stringify(value)
        : value,
    );
  }
  return { cols, params };
}

async function insertDoc(data: Record<string, any>): Promise<LandRecordDoc> {
  const pool = requirePool();
  if (!data.createdAt) data.createdAt = new Date();
  data.updatedAt = new Date();
  const { cols, params } = toColumnParams(data);
  const placeholders = params.map((_, i) => `$${i + 1}`);
  const sql = `INSERT INTO land_records (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
  const result = await pool.query(sql, params);
  return mapRow(result.rows[0]);
}

async function updateById(id: string, data: Record<string, any>): Promise<LandRecordDoc> {
  const pool = requirePool();
  data.updatedAt = new Date();
  const { cols, params } = toColumnParams(data);
  const sets = cols.map((c, i) => `${c} = $${i + 1}`);
  params.push(id);
  const sql = `UPDATE land_records SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`;
  const result = await pool.query(sql, params);
  if (result.rows.length === 0) throw new Error(`LandRecord ${id} not found`);
  return mapRow(result.rows[0]);
}

/** Attach a save() closure to a mapped row (findById / findOne results). */
function attachSave(row: LandRecordDoc): LandRecordDoc {
  const doc: any = { ...row };
  doc.save = async () => {
    const saved = await updateById(doc.id, pickWritable(doc));
    Object.assign(doc, saved);
    return doc;
  };
  return doc as LandRecordDoc;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LandRecordDoc = Record<string, any> & {
  _id: string;
  id: string;
  save: () => Promise<LandRecordDoc>;
};

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export class LandRecord {
  [key: string]: any;
  _id!: string;
  id!: string;
  save!: () => Promise<LandRecordDoc>;

  /** `new LandRecord(data)` — an unsaved document; call .save() to insert. */
  constructor(data: Record<string, any> = {}) {
    for (const [k, v] of Object.entries(data)) {
      this[k] = v;
    }
    const self = this;
    this.save = async () => {
      const saved = await insertDoc(pickWritable(self));
      Object.assign(self, saved);
      return self;
    };
  }

  // --- Statics -------------------------------------------------------------

  static async findById(id: string): Promise<LandRecordDoc | null> {
    const pool = requirePool();
    if (!UUID_RE.test(id)) return null; // non-uuid ids can never match
    const result = await pool.query('SELECT * FROM land_records WHERE id = $1', [id]);
    return result.rows.length ? attachSave(mapRow(result.rows[0])) : null;
  }

  static async findOne(filter: Record<string, unknown>): Promise<LandRecordDoc | null> {
    const pool = requirePool();
    const { where, params } = translateFilter(filter);
    const result = await pool.query(
      `SELECT * FROM land_records WHERE ${where} LIMIT 1`,
      params,
    );
    return result.rows.length ? attachSave(mapRow(result.rows[0])) : null;
  }

  /** Returns a thenable builder supporting .sort().select().limit().lean(). */
  static find(filter: Record<string, unknown> = {}): LandRecordQuery {
    return new LandRecordQuery(filter);
  }

  static async insertMany(docs: Array<Record<string, any>>): Promise<LandRecordDoc[]> {
    const saved: LandRecordDoc[] = [];
    for (const d of docs) {
      saved.push(await insertDoc({ ...d }));
    }
    return saved;
  }

  /** Clears every land record (children first, then documents). */
  static async deleteAll(): Promise<void> {
    const pool = requirePool();
    await pool.query('DELETE FROM land_records WHERE document_id IS NOT NULL');
    await pool.query('DELETE FROM land_records');
  }

  /**
   * Duplicate-detection query (Sprint C validator): rows with the same
   * extracted khasraNumber + village (case-insensitive), same sub-survey
   * when supplied (or both empty), optionally scoped to a district.
   */
  static async findDuplicateMatches(params: {
    khasraNumber: string;
    village: string;
    subSurveyNumber: string | null;
    district?: string | null;
    excludeRecordId?: string | null;
  }): Promise<LandRecordDoc[]> {
    const pool = requirePool();
    const clauses: string[] = [
      `extracted_fields->'khasraNumber'->>'value' = $1`,
      `lower(coalesce(extracted_fields->'village'->>'value', '')) = lower($2)`,
    ];
    const values: unknown[] = [params.khasraNumber, params.village];
    if (params.subSurveyNumber) {
      values.push(params.subSurveyNumber);
      clauses.push(`extracted_fields->'subSurveyNumber'->>'value' = $${values.length}`);
    } else {
      clauses.push(`coalesce(extracted_fields->'subSurveyNumber'->>'value', '') = ''`);
    }
    if (params.district) {
      values.push(params.district);
      clauses.push(
        `lower(coalesce(extracted_fields->'district'->>'value', '')) = lower($${values.length})`,
      );
    }
    if (params.excludeRecordId) {
      values.push(params.excludeRecordId);
      clauses.push(`id <> $${values.length}::uuid`);
    }
    const result = await pool.query(
      `SELECT * FROM land_records WHERE ${clauses.join(' AND ')}`,
      values,
    );
    return result.rows.map(mapRow);
  }

  /**
   * Area-sum check (Sprint C validator): plotArea strings of every row in a
   * village (case-insensitive on the extracted village value) that has one.
   */
  static async getPlotAreaValuesForVillage(
    village: string,
    excludeRecordId?: string | null,
  ): Promise<string[]> {
    const pool = requirePool();
    const values: unknown[] = [village];
    let sql =
      `SELECT extracted_fields->'plotArea'->>'value' AS plot_area
       FROM land_records
       WHERE lower(coalesce(extracted_fields->'village'->>'value', '')) = lower($1)
         AND coalesce(extracted_fields->'plotArea'->>'value', '') <> ''`;
    if (excludeRecordId) {
      values.push(excludeRecordId);
      sql += ` AND id <> $${values.length}::uuid`;
    }
    const result = await pool.query(sql, values);
    return result.rows.map((r: any) => r.plot_area).filter((v: any) => typeof v === 'string');
  }
}

// ---------------------------------------------------------------------------
// Query builder — supports the .sort().select().limit().lean() chains
// ---------------------------------------------------------------------------

export class LandRecordQuery {
  private orderBy: string | null = null;
  private limitCount: number | null = null;

  constructor(private filter: Record<string, unknown>) {}

  sort(spec: Record<string, 1 | -1>): this {
    const parts: string[] = [];
    for (const [key, dir] of Object.entries(spec)) {
      const column = COLUMNS[key === '_id' ? 'id' : key];
      if (column) parts.push(`${column} ${dir === -1 ? 'DESC' : 'ASC'}`);
    }
    this.orderBy = parts.length ? parts.join(', ') : null;
    return this;
  }

  // Projection is a bandwidth optimisation only — controllers pick the fields
  // they need from the full mapped row.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  select(_fields: string): this {
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  /** Mongoose parity — results are always plain objects here. */
  lean(): Promise<LandRecordDoc[]> {
    return this.exec();
  }

  then<T = LandRecordDoc[]>(
    onfulfilled?: (value: LandRecordDoc[]) => T | PromiseLike<T>,
    onrejected?: (reason: unknown) => T | PromiseLike<T>,
  ): PromiseLike<T | LandRecordDoc[]> {
    return this.exec().then(onfulfilled, onrejected);
  }

  private async exec(): Promise<LandRecordDoc[]> {
    const pool = requirePool();
    const { where, params } = translateFilter(this.filter);
    let sql = `SELECT * FROM land_records WHERE ${where}`;
    if (this.orderBy) sql += ` ORDER BY ${this.orderBy}`;
    if (this.limitCount != null) sql += ` LIMIT ${this.limitCount}`;
    const result = await pool.query(sql, params);
    return result.rows.map(mapRow);
  }
}

export default LandRecord;
