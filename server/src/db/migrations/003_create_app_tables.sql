-- Migration: 003_create_app_tables.sql
-- Creates the core application tables that previously lived in MongoDB.
-- Supabase Postgres is now the ONLY datastore (land records, users, audit,
-- usage, notifications, review queue). JSONB columns hold the nested
-- extraction payloads so the API response shapes stay unchanged.
--
-- Applies to: Supabase Postgres, or the local docker PostGIS (dev).

-- ---------------------------------------------------------------------------
-- users — mirrors Supabase Auth users; the authoritative app role lives here
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_id   TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'officer'
                CHECK (role IN ('officer', 'reviewer', 'admin')),
  name          TEXT,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_supabase_id_idx ON users (supabase_id);

-- ---------------------------------------------------------------------------
-- land_records — uploaded documents AND their extracted child rows
-- (a child row references its upload via document_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS land_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename                TEXT,
  uploaded_by             TEXT,
  storage_path            TEXT,
  storage_url             TEXT,

  -- Multi-row extraction: child rows point at their parent document
  document_id             UUID REFERENCES land_records(id) ON DELETE CASCADE,
  row_index               INTEGER,
  page_no                 INTEGER,

  -- Location / identity
  village                 TEXT NOT NULL,
  district                TEXT,
  tehsil                  TEXT,
  state                   TEXT,
  khata_number            TEXT,
  khasra_number           TEXT,
  khatoni_number          TEXT,
  sub_survey_number       TEXT,
  father_or_husband_name  TEXT,
  remarks                 TEXT,

  -- Batch-import legacy fields
  owners                  JSONB DEFAULT '[]'::jsonb,
  co_owners               JSONB DEFAULT '[]'::jsonb,
  mutation_history        JSONB DEFAULT '[]'::jsonb,
  area_total              NUMERIC,
  area_unit               TEXT CHECK (area_unit IS NULL OR area_unit IN
                              ('HECTARE', 'ACRE', 'BIGHA', 'KILLA', 'MARLA')),

  -- AI extraction output (per-field value/confidence/source/bbox)
  extracted_fields        JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_source       TEXT CHECK (extraction_source IS NULL OR
                              extraction_source IN ('gemini', 'tesseract')),
  legacy_extracted_fields JSONB DEFAULT '[]'::jsonb,
  confidence_score        JSONB,

  -- Validation & routing
  validation_flags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_results      JSONB NOT NULL DEFAULT '[]'::jsonb,
  low_confidence_fields   JSONB NOT NULL DEFAULT '[]'::jsonb,

  status                  TEXT NOT NULL DEFAULT 'uploaded'
                          CHECK (status IN (
                            'uploaded', 'extracting', 'extracted',
                            'extraction_failed', 'needs_review',
                            'auto_approved', 'reviewed_approved',
                            'reviewed_rejected')),
  extraction_error        TEXT,
  reviewed_by             TEXT,
  reviewed_at             TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS land_records_document_row_idx
  ON land_records (document_id, row_index);
CREATE INDEX IF NOT EXISTS land_records_khasra_village_idx
  ON land_records (khasra_number, village);
CREATE INDEX IF NOT EXISTS land_records_village_idx ON land_records (village);
CREATE INDEX IF NOT EXISTS land_records_status_idx ON land_records (status);
CREATE INDEX IF NOT EXISTS land_records_uploaded_by_idx ON land_records (uploaded_by);
-- Duplicate detection queries filter on JSONB field values:
CREATE INDEX IF NOT EXISTS land_records_ef_khasra_idx
  ON land_records ((extracted_fields->'khasraNumber'->>'value'));
CREATE INDEX IF NOT EXISTS land_records_ef_village_idx
  ON land_records (lower(extracted_fields->'village'->>'value'));

-- ---------------------------------------------------------------------------
-- audit_logs — every mutation performed through the API
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  user_email    TEXT,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  ip            TEXT,
  user_agent    TEXT,
  metadata      JSONB,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON audit_logs (timestamp DESC);

-- ---------------------------------------------------------------------------
-- api_usage — per-call Gemini token/cost tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT,
  document_id       TEXT,
  model_name        TEXT NOT NULL,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  cost              NUMERIC,
  operation         TEXT NOT NULL,
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_usage_timestamp_idx ON api_usage (timestamp DESC);

-- ---------------------------------------------------------------------------
-- notifications — per-user in-app notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN (
               'review_requested', 'review_completed',
               'extraction_failed', 'extraction_complete')),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications (read);

-- ---------------------------------------------------------------------------
-- review_queue — documents waiting for a human reviewer
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  land_record_id UUID NOT NULL REFERENCES land_records(id) ON DELETE CASCADE,
  priority       TEXT NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low', 'medium', 'high')),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'assigned', 'completed')),
  assigned_to    TEXT,
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_queue_status_idx ON review_queue (status);
CREATE INDEX IF NOT EXISTS review_queue_record_idx ON review_queue (land_record_id);
