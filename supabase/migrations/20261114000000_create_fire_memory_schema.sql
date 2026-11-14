-- FIRE MEMORY: Initial Schema Migration
-- NASA Space Apps Challenge 2026
-- Owned by Member 2 (Backend and Analytics)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. REGIONS
-- Country, administrative regions, and provinces with bounding boxes
-- ============================================================================
CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('country', 'region', 'province', 'custom')),
    parent_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
    bbox JSONB NOT NULL, -- [minLon, minLat, maxLon, maxLat]
    province TEXT,
    country TEXT NOT NULL DEFAULT 'Philippines',
    boundary JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_regions_level ON regions(level);
CREATE INDEX IF NOT EXISTS idx_regions_parent_id ON regions(parent_id);

-- ============================================================================
-- 2. HOTSPOTS
-- Recent raw window only (last 12-24 months) for map markers and raw CSV
-- ============================================================================
CREATE TABLE IF NOT EXISTS hotspots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT,
    source_key TEXT, -- deduplication key to guarantee idempotent ingestion
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    acquisition_datetime TIMESTAMPTZ NOT NULL,
    satellite TEXT NOT NULL,
    instrument TEXT NOT NULL CHECK (instrument IN ('MODIS', 'VIIRS')),
    confidence TEXT, -- preserves original numeric or categorical values
    brightness DOUBLE PRECISION,
    source_product TEXT,
    province_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_hotspots_source_key UNIQUE (source_key)
);

CREATE INDEX IF NOT EXISTS idx_hotspots_acq_datetime ON hotspots(acquisition_datetime);
CREATE INDEX IF NOT EXISTS idx_hotspots_province_id ON hotspots(province_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_instrument ON hotspots(instrument);
CREATE INDEX IF NOT EXISTS idx_hotspots_lat_lon ON hotspots(latitude, longitude);

-- ============================================================================
-- 3. MONTHLY_COUNTS
-- Full historical raw counts & active cell-days per province/country/month
-- ============================================================================
CREATE TABLE IF NOT EXISTS monthly_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    instrument TEXT NOT NULL CHECK (instrument IN ('MODIS', 'VIIRS')),
    raw_count INTEGER NOT NULL DEFAULT 0,
    active_cell_days INTEGER NOT NULL DEFAULT 0,
    has_coverage BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_monthly_counts_region_period_instrument UNIQUE (region_id, year, month, instrument)
);

CREATE INDEX IF NOT EXISTS idx_monthly_counts_lookup ON monthly_counts(region_id, year, month, instrument);
CREATE INDEX IF NOT EXISTS idx_monthly_counts_month ON monthly_counts(month);

-- ============================================================================
-- 4. MONTHLY_HARMONIZED
-- Full historical harmonized series (VIIRS-equivalent target)
-- ============================================================================
CREATE TABLE IF NOT EXISTS monthly_harmonized (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    harmonized_count DOUBLE PRECISION,
    is_estimated BOOLEAN NOT NULL DEFAULT false,
    method_version TEXT NOT NULL DEFAULT 'v1.0-median-ratio',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_monthly_harmonized_region_period UNIQUE (region_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_harmonized_lookup ON monthly_harmonized(region_id, year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_harmonized_month ON monthly_harmonized(month);

-- ============================================================================
-- 5. MONTHLY_GRID_COUNTS
-- 0.1 degree coarse grid counts for custom area draw (approximate aggregation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS monthly_grid_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id TEXT NOT NULL,
    cell_lat DOUBLE PRECISION NOT NULL,
    cell_lon DOUBLE PRECISION NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    instrument TEXT NOT NULL CHECK (instrument IN ('MODIS', 'VIIRS')),
    raw_count INTEGER NOT NULL DEFAULT 0,
    active_cell_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_monthly_grid_cell_period_instrument UNIQUE (cell_id, year, month, instrument)
);

CREATE INDEX IF NOT EXISTS idx_monthly_grid_cell_period ON monthly_grid_counts(cell_id, year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_grid_coords ON monthly_grid_counts(cell_lat, cell_lon);

-- ============================================================================
-- 6. HARMONIZATION_FACTORS
-- Conversion parameters and validation stats (region_id IS NULL for national)
-- ============================================================================
CREATE TABLE IF NOT EXISTS harmonization_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id TEXT REFERENCES regions(id) ON DELETE CASCADE,
    factor DOUBLE PRECISION NOT NULL,
    method TEXT NOT NULL,
    overlap_years INTEGER[] NOT NULL,
    n_months INTEGER NOT NULL,
    correlation DOUBLE PRECISION,
    error_percent DOUBLE PRECISION,
    estimated_years INTEGER[] NOT NULL DEFAULT '{}',
    notes TEXT[] NOT NULL DEFAULT '{}',
    computed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_harmonization_factors_region UNIQUE (region_id)
);

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_harmonized ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_grid_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE harmonization_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to regions" ON regions FOR SELECT USING (true);
CREATE POLICY "Allow public read access to hotspots" ON hotspots FOR SELECT USING (true);
CREATE POLICY "Allow public read access to monthly_counts" ON monthly_counts FOR SELECT USING (true);
CREATE POLICY "Allow public read access to monthly_harmonized" ON monthly_harmonized FOR SELECT USING (true);
CREATE POLICY "Allow public read access to monthly_grid_counts" ON monthly_grid_counts FOR SELECT USING (true);
CREATE POLICY "Allow public read access to harmonization_factors" ON harmonization_factors FOR SELECT USING (true);
