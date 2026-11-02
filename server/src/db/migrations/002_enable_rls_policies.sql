-- Migration: 002_enable_rls_policies.sql
-- Enable Row Level Security (RLS) on key tables as defense-in-depth.
-- Note: Application layer enforces authz; RLS adds additional protection.
--
-- Supabase-only: references auth.role() and Supabase's PostGres roles
-- (authenticated / service_role). Run in the Supabase SQL editor or via
-- `supabase db execute`. NOT for the local docker PostGIS instance.
--
-- PostgreSQL has no `CREATE POLICY IF NOT EXISTS`, so each policy is created
-- inside a DO block guarded by a pg_policies lookup.

-- ---------------------------------------------------------------------------
-- land_records (if the table exists — records primarily live in MongoDB)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'land_records') THEN
    ALTER TABLE land_records ENABLE ROW LEVEL SECURITY;

    -- Policy: authenticated users can read land records.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'land_records' AND policyname = 'land_records_read_authenticated') THEN
      CREATE POLICY "land_records_read_authenticated" ON land_records
        FOR SELECT
        USING (auth.role() = 'authenticated');
    END IF;

    -- Policy: service role can do anything.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'land_records' AND policyname = 'land_records_all_service_role') THEN
      CREATE POLICY "land_records_all_service_role" ON land_records
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- plots
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plots') THEN
    ALTER TABLE plots ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plots' AND policyname = 'plots_read_authenticated') THEN
      CREATE POLICY "plots_read_authenticated" ON plots
        FOR SELECT
        USING (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plots' AND policyname = 'plots_all_service_role') THEN
      CREATE POLICY "plots_all_service_role" ON plots
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
    END IF;
  END IF;
END $$;
