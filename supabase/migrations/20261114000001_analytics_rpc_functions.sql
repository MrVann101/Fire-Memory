-- FIRE MEMORY: SQL Analytics & Percentile Median RPC Functions
-- Owned by Member 2 (Backend and Analytics)
-- Enforces Rule 3: Median and counts are computed in SQL (GROUP BY and percentile_cont).

-- ============================================================================
-- 1. HARMONIZED SUMMARY METRICS RPC
-- Computes SQL percentile_cont(0.5) over complete past years for a region & month
-- ============================================================================
CREATE OR REPLACE FUNCTION get_harmonized_summary_metrics(
    p_region_id TEXT,
    p_target_year INTEGER,
    p_month INTEGER,
    p_current_utc_year INTEGER
)
RETURNS TABLE (
    current_count DOUBLE PRECISION,
    current_is_estimated BOOLEAN,
    historical_median DOUBLE PRECISION,
    baseline_years INTEGER[],
    estimated_baseline_years INTEGER[],
    first_date TEXT,
    last_date TEXT,
    last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_current_count DOUBLE PRECISION;
    v_current_est BOOLEAN := false;
    v_median DOUBLE PRECISION;
    v_baseline_years INTEGER[];
    v_est_years INTEGER[];
    v_first_ym TEXT;
    v_last_ym TEXT;
    v_last_upd TIMESTAMPTZ;
BEGIN
    -- Current target period
    SELECT mh.harmonized_count, mh.is_estimated
    INTO v_current_count, v_current_est
    FROM monthly_harmonized mh
    WHERE mh.region_id = p_region_id
      AND mh.year = p_target_year
      AND mh.month = p_month
    LIMIT 1;

    -- Baseline: complete past years (< current UTC year, excluding target year, non-null)
    SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY mh.harmonized_count),
        COALESCE(array_agg(mh.year ORDER BY mh.year), '{}'),
        COALESCE(array_agg(mh.year ORDER BY mh.year) FILTER (WHERE mh.is_estimated = true), '{}')
    INTO v_median, v_baseline_years, v_est_years
    FROM monthly_harmonized mh
    WHERE mh.region_id = p_region_id
      AND mh.month = p_month
      AND mh.year < p_current_utc_year
      AND mh.year <> p_target_year
      AND mh.harmonized_count IS NOT NULL;

    -- Data coverage span
    SELECT
        to_char(MIN(make_date(mh.year, mh.month, 1)), 'YYYY-MM-DD'),
        to_char((MAX(make_date(mh.year, mh.month, 1)) + INTERVAL '1 month - 1 day')::date, 'YYYY-MM-DD'),
        MAX(mh.created_at)
    INTO v_first_ym, v_last_ym, v_last_upd
    FROM monthly_harmonized mh
    WHERE mh.region_id = p_region_id
      AND mh.harmonized_count IS NOT NULL;

    RETURN QUERY SELECT
        v_current_count,
        COALESCE(v_current_est, false),
        v_median,
        COALESCE(v_baseline_years, '{}'),
        COALESCE(v_est_years, '{}'),
        v_first_ym,
        v_last_ym,
        v_last_upd;
END;
$$;

-- ============================================================================
-- 2. RAW SUMMARY METRICS RPC
-- Computes SQL GROUP BY + percentile_cont(0.5) on monthly_counts
-- ============================================================================
CREATE OR REPLACE FUNCTION get_raw_summary_metrics(
    p_region_id TEXT,
    p_target_year INTEGER,
    p_month INTEGER,
    p_instrument TEXT, -- 'MODIS', 'VIIRS', or 'ALL'
    p_current_utc_year INTEGER
)
RETURNS TABLE (
    current_count DOUBLE PRECISION,
    modis_count DOUBLE PRECISION,
    viirs_count DOUBLE PRECISION,
    historical_median DOUBLE PRECISION,
    baseline_years INTEGER[],
    first_date TEXT,
    last_date TEXT,
    last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_current_count DOUBLE PRECISION;
    v_modis DOUBLE PRECISION;
    v_viirs DOUBLE PRECISION;
    v_median DOUBLE PRECISION;
    v_baseline_years INTEGER[];
    v_first_ym TEXT;
    v_last_ym TEXT;
    v_last_upd TIMESTAMPTZ;
BEGIN
    -- Breakdown for target period
    SELECT mc.raw_count::DOUBLE PRECISION
    INTO v_modis
    FROM monthly_counts mc
    WHERE mc.region_id = p_region_id
      AND mc.year = p_target_year
      AND mc.month = p_month
      AND mc.instrument = 'MODIS'
      AND mc.has_coverage = true
    LIMIT 1;

    SELECT mc.raw_count::DOUBLE PRECISION
    INTO v_viirs
    FROM monthly_counts mc
    WHERE mc.region_id = p_region_id
      AND mc.year = p_target_year
      AND mc.month = p_month
      AND mc.instrument = 'VIIRS'
      AND mc.has_coverage = true
    LIMIT 1;

    IF p_instrument = 'MODIS' THEN
        v_current_count := v_modis;
    ELSIF p_instrument = 'VIIRS' THEN
        v_current_count := v_viirs;
    ELSE
        IF v_modis IS NOT NULL OR v_viirs IS NOT NULL THEN
            v_current_count := COALESCE(v_modis, 0) + COALESCE(v_viirs, 0);
        ELSE
            v_current_count := NULL;
        END IF;
    END IF;

    -- Baseline SQL calculation using GROUP BY year and percentile_cont(0.5)
    WITH yearly_totals AS (
        SELECT
            mc.year,
            SUM(mc.raw_count)::DOUBLE PRECISION AS total_raw
        FROM monthly_counts mc
        WHERE mc.region_id = p_region_id
          AND mc.month = p_month
          AND mc.year < p_current_utc_year
          AND mc.year <> p_target_year
          AND mc.has_coverage = true
          AND (p_instrument = 'ALL' OR mc.instrument = p_instrument)
        GROUP BY mc.year
    )
    SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY yt.total_raw),
        COALESCE(array_agg(yt.year ORDER BY yt.year), '{}')
    INTO v_median, v_baseline_years
    FROM yearly_totals yt;

    -- Coverage span
    SELECT
        to_char(MIN(make_date(mc.year, mc.month, 1)), 'YYYY-MM-DD'),
        to_char((MAX(make_date(mc.year, mc.month, 1)) + INTERVAL '1 month - 1 day')::date, 'YYYY-MM-DD'),
        MAX(mc.created_at)
    INTO v_first_ym, v_last_ym, v_last_upd
    FROM monthly_counts mc
    WHERE mc.region_id = p_region_id
      AND mc.has_coverage = true
      AND (p_instrument = 'ALL' OR mc.instrument = p_instrument);

    RETURN QUERY SELECT
        v_current_count,
        v_modis,
        v_viirs,
        v_median,
        COALESCE(v_baseline_years, '{}'),
        v_first_ym,
        v_last_ym,
        v_last_upd;
END;
$$;

-- ============================================================================
-- 3. CUSTOM BBOX GRID AGGREGATION RPC
-- Aggregates monthly_grid_counts inside [minLon, minLat, maxLon, maxLat]
-- ============================================================================
CREATE OR REPLACE FUNCTION get_custom_bbox_calendar(
    p_min_lon DOUBLE PRECISION,
    p_min_lat DOUBLE PRECISION,
    p_max_lon DOUBLE PRECISION,
    p_max_lat DOUBLE PRECISION,
    p_metric TEXT,
    p_instrument TEXT,
    p_national_factor DOUBLE PRECISION
)
RETURNS TABLE (
    year INTEGER,
    month INTEGER,
    count DOUBLE PRECISION,
    estimated BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
    WITH cells_in_box AS (
        SELECT
            mgc.year,
            mgc.month,
            mgc.instrument,
            SUM(mgc.raw_count)::DOUBLE PRECISION AS sum_raw,
            SUM(mgc.active_cell_days)::DOUBLE PRECISION AS sum_acd
        FROM monthly_grid_counts mgc
        WHERE mgc.cell_lon >= p_min_lon
          AND mgc.cell_lon <= p_max_lon
          AND mgc.cell_lat >= p_min_lat
          AND mgc.cell_lat <= p_max_lat
        GROUP BY mgc.year, mgc.month, mgc.instrument
    ),
    pivoted AS (
        SELECT
            c.year,
            c.month,
            MAX(CASE WHEN c.instrument = 'VIIRS' THEN c.sum_acd END) AS viirs_acd,
            MAX(CASE WHEN c.instrument = 'MODIS' THEN c.sum_acd END) AS modis_acd,
            MAX(CASE WHEN c.instrument = 'VIIRS' THEN c.sum_raw END) AS viirs_raw,
            MAX(CASE WHEN c.instrument = 'MODIS' THEN c.sum_raw END) AS modis_raw
        FROM cells_in_box c
        GROUP BY c.year, c.month
    )
    SELECT
        p.year,
        p.month,
        CASE
            WHEN p_metric = 'harmonized' THEN
                CASE
                    WHEN p.viirs_acd IS NOT NULL THEN p.viirs_acd
                    WHEN p.modis_acd IS NOT NULL AND p_national_factor IS NOT NULL THEN ROUND((p.modis_acd * p_national_factor)::numeric, 2)::DOUBLE PRECISION
                    ELSE NULL
                END
            ELSE
                CASE
                    WHEN p_instrument = 'VIIRS' THEN p.viirs_raw
                    WHEN p_instrument = 'MODIS' THEN p.modis_raw
                    ELSE COALESCE(p.viirs_raw, 0) + COALESCE(p.modis_raw, 0)
                END
        END AS count,
        CASE
            WHEN p_metric = 'harmonized' AND p.viirs_acd IS NULL AND p.modis_acd IS NOT NULL THEN true
            ELSE false
        END AS estimated
    FROM pivoted p
    ORDER BY p.year ASC, p.month ASC;
$$;
