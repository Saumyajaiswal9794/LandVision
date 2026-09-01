-- Sprint 4: Enable PostGIS and create the plots table
-- Run this in Supabase SQL editor or via your Postgres client

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS plots (
  id SERIAL PRIMARY KEY,
  khasra_number TEXT NOT NULL,
  village TEXT NOT NULL,
  district TEXT NOT NULL,
  geom GEOMETRY(Polygon, 4326) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plots_geom_idx ON plots USING GIST (geom);
CREATE INDEX IF NOT EXISTS plots_khasra_village_idx ON plots (khasra_number, village);
