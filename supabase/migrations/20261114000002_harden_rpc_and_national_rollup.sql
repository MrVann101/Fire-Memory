-- FIRE MEMORY: Harden RPC search_path, National Factor Uniqueness & National Rollup Fallback
-- Owned by Member 2 (Backend and Analytics)

-- 1. Enforce single-row uniqueness for the national harmonization factor (region_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_harmonization_factors_national_null
    ON public.harmonization_factors ((1))
    WHERE region_id IS NULL;

-- 2. Harmonized summary metrics RPC with fixed search_path and automatic national rollup fallback
CREATE OR REPLACE FUNCTION public.get_harmonized_summary_metrics(
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_has_direct BOOLEAN := false;
    v_is_country BOOLEAN := false;
    v_current_count DOUBLE PRECISION;
    v_current_est BOOLEAN := false;
    v_median DOUBLE PRECISION;
    v_baseline_years INTEGER[];
    v_est_years INTEGER[];
    v_first_ym TEXT;
    v_last_ym TEXT;
    v_last_upd TIMESTAMPTZ;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.monthly_harmonized mh
        WHERE mh.region_id = p_region_id
          AND mh.harmonized_count IS NOT NULL
    ) INTO v_has_direct;

    IF NOT v_has_direct THEN
        SELECT (
            p_region_id = 'PH'
            OR EXISTS (
                SELECT 1
                FROM public.regions r
                WHERE r.id = p_region_id
                  AND r.level = 'country'
            )
        ) INTO v_is_country;
    END IF;

    IF v_has_direct OR NOT v_is_country THEN
        SELECT mh.harmonized_count, mh.is_estimated
        INTO v_current_count, v_current_est
        FROM public.monthly_harmonized mh
        WHERE mh.region_id = p_region_id
          AND mh.year = p_target_year
          AND mh.month = p_month
        LIMIT 1;

        SELECT
            percentile_cont(0.5) WITHIN GROUP (ORDER BY mh.harmonized_count),
            COALESCE(array_agg(mh.year ORDER BY mh.year), '{}'),
            COALESCE(array_agg(mh.year ORDER BY mh.year) FILTER (WHERE mh.is_estimated = true), '{}')
        INTO v_median, v_baseline_years, v_est_years
        FROM public.monthly_harmonized mh
        WHERE mh.region_id = p_region_id
          AND mh.month = p_month
          AND mh.year < p_current_utc_year
          AND mh.year <> p_target_year
          AND mh.harmonized_count IS NOT NULL;

        SELECT
            to_char(MIN(make_date(mh.year, mh.month, 1)), 'YYYY-MM-DD'),
            to_char((MAX(make_date(mh.year, mh.month, 1)) + INTERVAL '1 month - 1 day')::date, 'YYYY-MM-DD'),
            MAX(mh.created_at)
        INTO v_first_ym, v_last_ym, v_last_upd
        FROM public.monthly_harmonized mh
        WHERE mh.region_id = p_region_id
          AND mh.harmonized_count IS NOT NULL;
    ELSE
        -- National rollup across province rows when no direct country row exists
        WITH national_periods AS (
            SELECT
                mh.year,
                mh.month,
                SUM(mh.harmonized_count)::DOUBLE PRECISION AS harmonized_count,
                BOOL_OR(mh.is_estimated) AS is_estimated,
                MAX(mh.created_at) AS created_at
            FROM public.monthly_harmonized mh
            LEFT JOIN public.regions r ON r.id = mh.region_id
            WHERE COALESCE(r.level, 'province') = 'province'
              AND mh.harmonized_count IS NOT NULL
            GROUP BY mh.year, mh.month
        )
        SELECT np.harmonized_count, np.is_estimated
        INTO v_current_count, v_current_est
        FROM national_periods np
        WHERE np.year = p_target_year
          AND np.month = p_month
        LIMIT 1;

        WITH national_periods AS (
            SELECT
                mh.year,
                mh.month,
                SUM(mh.harmonized_count)::DOUBLE PRECISION AS harmonized_count,
                BOOL_OR(mh.is_estimated) AS is_estimated
            FROM public.monthly_harmonized mh
            LEFT JOIN public.regions r ON r.id = mh.region_id
            WHERE COALESCE(r.level, 'province') = 'province'
              AND mh.harmonized_count IS NOT NULL
            GROUP BY mh.year, mh.month
        )
        SELECT
            percentile_cont(0.5) WITHIN GROUP (ORDER BY np.harmonized_count),
            COALESCE(array_agg(np.year ORDER BY np.year), '{}'),
            COALESCE(array_agg(np.year ORDER BY np.year) FILTER (WHERE np.is_estimated = true), '{}')
        INTO v_median, v_baseline_years, v_est_years
        FROM national_periods np
        WHERE np.month = p_month
          AND np.year < p_current_utc_year
          AND np.year <> p_target_year;

        SELECT
            to_char(MIN(make_date(mh.year, mh.month, 1)), 'YYYY-MM-DD'),
            to_char((MAX(make_date(mh.year, mh.month, 1)) + INTERVAL '1 month - 1 day')::date, 'YYYY-MM-DD'),
            MAX(mh.created_at)
        INTO v_first_ym, v_last_ym, v_last_upd
        FROM public.monthly_harmonized mh
        LEFT JOIN public.regions r ON r.id = mh.region_id
        WHERE COALESCE(r.level, 'province') = 'province'
          AND mh.harmonized_count IS NOT NULL;
    END IF;

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

-- 3. Raw summary metrics RPC with fixed search_path and automatic national rollup fallback
CREATE OR REPLACE FUNCTION public.get_raw_summary_metrics(
    p_region_id TEXT,
    p_target_year INTEGER,
    p_month INTEGER,
    p_instrument TEXT,
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_has_direct BOOLEAN := false;
    v_is_country BOOLEAN := false;
    v_current_count DOUBLE PRECISION;
    v_modis DOUBLE PRECISION;
    v_viirs DOUBLE PRECISION;
    v_median DOUBLE PRECISION;
    v_baseline_years INTEGER[];
    v_first_ym TEXT;
    v_last_ym TEXT;
    v_last_upd TIMESTAMPTZ;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.monthly_counts mc
        WHERE mc.region_id = p_region_id
          AND mc.has_coverage = true
    ) INTO v_has_direct;

    IF NOT v_has_direct THEN
        SELECT (
            p_region_id = 'PH'
            OR EXISTS (
                SELECT 1
                FROM public.regions r
                WHERE r.id = p_region_id
                  AND r.level = 'country'
            )
        ) INTO v_is_country;
    END IF;

    IF v_has_direct OR NOT v_is_country THEN
        SELECT mc.raw_count::DOUBLE PRECISION
        INTO v_modis
        FROM public.monthly_counts mc
        WHERE mc.region_id = p_region_id
          AND mc.year = p_target_year
          AND mc.month = p_month
          AND mc.instrument = 'MODIS'
          AND mc.has_coverage = true
        LIMIT 1;

        SELECT mc.raw_count::DOUBLE PRECISION
        INTO v_viirs
        FROM public.monthly_counts mc
        WHERE mc.region_id = p_region_id
          AND mc.year = p_target_year
          AND mc.month = p_month
          AND mc.instrument = 'VIIRS'
          AND mc.has_coverage = true
        LIMIT 1;

        WITH yearly_totals AS (
            SELECT
                mc.year,
                SUM(mc.raw_count)::DOUBLE PRECISION AS total_raw
            FROM public.monthly_counts mc
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

        SELECT
            to_char(MIN(make_date(mc.year, mc.month, 1)), 'YYYY-MM-DD'),
            to_char((MAX(make_date(mc.year, mc.month, 1)) + INTERVAL '1 month - 1 day')::date, 'YYYY-MM-DD'),
            MAX(mc.created_at)
        INTO v_first_ym, v_last_ym, v_last_upd
        FROM public.monthly_counts mc
        WHERE mc.region_id = p_region_id
          AND mc.has_coverage = true
          AND (p_instrument = 'ALL' OR mc.instrument = p_instrument);
    ELSE
        -- National rollup across province rows when no direct country row exists
        SELECT SUM(mc.raw_count)::DOUBLE PRECISION
        INTO v_modis
        FROM public.monthly_counts mc
        LEFT JOIN public.regions r ON r.id = mc.region_id
        WHERE COALESCE(r.level, 'province') = 'province'
          AND mc.year = p_target_year
          AND mc.month = p_month
          AND mc.instrument = 'MODIS'
          AND mc.has_coverage = true;

        SELECT SUM(mc.raw_count)::DOUBLE PRECISION
        INTO v_viirs
        FROM public.monthly_counts mc
        LEFT JOIN public.regions r ON r.id = mc.region_id
        WHERE COALESCE(r.level, 'province') = 'province'
          AND mc.year = p_target_year
          AND mc.month = p_month
          AND mc.instrument = 'VIIRS'
          AND mc.has_coverage = true;

        WITH yearly_totals AS (
            SELECT
                mc.year,
                SUM(mc.raw_count)::DOUBLE PRECISION AS total_raw
            FROM public.monthly_counts mc
            LEFT JOIN public.regions r ON r.id = mc.region_id
            WHERE COALESCE(r.level, 'province') = 'province'
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

        SELECT
            to_char(MIN(make_date(mc.year, mc.month, 1)), 'YYYY-MM-DD'),
            to_char((MAX(make_date(mc.year, mc.month, 1)) + INTERVAL '1 month - 1 day')::date, 'YYYY-MM-DD'),
            MAX(mc.created_at)
        INTO v_first_ym, v_last_ym, v_last_upd
        FROM public.monthly_counts mc
        LEFT JOIN public.regions r ON r.id = mc.region_id
        WHERE COALESCE(r.level, 'province') = 'province'
          AND mc.has_coverage = true
          AND (p_instrument = 'ALL' OR mc.instrument = p_instrument);
    END IF;

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

-- 4. Custom bbox grid aggregation RPC with fixed search_path and null-safe raw sum
CREATE OR REPLACE FUNCTION public.get_custom_bbox_calendar(
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
SET search_path = public, pg_temp
AS $$
    WITH cells_in_box AS (
        SELECT
            mgc.year,
            mgc.month,
            mgc.instrument,
            SUM(mgc.raw_count)::DOUBLE PRECISION AS sum_raw,
            SUM(mgc.active_cell_days)::DOUBLE PRECISION AS sum_acd
        FROM public.monthly_grid_counts mgc
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
                    WHEN p.viirs_raw IS NOT NULL OR p.modis_raw IS NOT NULL THEN COALESCE(p.viirs_raw, 0) + COALESCE(p.modis_raw, 0)
                    ELSE NULL
                END
        END AS count,
        CASE
            WHEN p_metric = 'harmonized' AND p.viirs_acd IS NULL AND p.modis_acd IS NOT NULL AND p_national_factor IS NOT NULL THEN true
            ELSE false
        END AS estimated
    FROM pivoted p
    ORDER BY p.year ASC, p.month ASC;
$$;

-- 5. Add scope and fallback_reason columns to harmonization_factors for sparse-province fallback tracking
ALTER TABLE public.harmonization_factors
    ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'province' CHECK (scope IN ('province', 'national')),
    ADD COLUMN IF NOT EXISTS fallback_reason TEXT;

UPDATE public.harmonization_factors
SET scope = 'national'
WHERE region_id IS NULL;

-- 6. National calendar rollup RPC across all province rows
CREATE OR REPLACE FUNCTION public.get_national_calendar(
    p_metric TEXT,
    p_instrument TEXT DEFAULT 'ALL'
)
RETURNS TABLE (
    year INTEGER,
    month INTEGER,
    count DOUBLE PRECISION,
    estimated BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_metric = 'harmonized' THEN
        RETURN QUERY
        SELECT
            mh.year,
            mh.month,
            CASE
                WHEN COUNT(mh.harmonized_count) > 0 THEN SUM(mh.harmonized_count)::DOUBLE PRECISION
                ELSE NULL::DOUBLE PRECISION
            END AS count,
            CASE
                WHEN COUNT(mh.harmonized_count) > 0 THEN BOOL_OR(mh.is_estimated)
                ELSE false
            END AS estimated
        FROM public.monthly_harmonized mh
        LEFT JOIN public.regions r ON r.id = mh.region_id
        WHERE COALESCE(r.level, 'province') = 'province'
        GROUP BY mh.year, mh.month
        ORDER BY mh.year ASC, mh.month ASC;
    ELSE
        RETURN QUERY
        SELECT
            mc.year,
            mc.month,
            CASE
                WHEN BOOL_OR(mc.has_coverage) THEN SUM(CASE WHEN mc.has_coverage THEN mc.raw_count ELSE 0 END)::DOUBLE PRECISION
                ELSE NULL::DOUBLE PRECISION
            END AS count,
            false AS estimated
        FROM public.monthly_counts mc
        LEFT JOIN public.regions r ON r.id = mc.region_id
        WHERE COALESCE(r.level, 'province') = 'province'
          AND (p_instrument = 'ALL' OR mc.instrument = p_instrument)
        GROUP BY mc.year, mc.month
        ORDER BY mc.year ASC, mc.month ASC;
    END IF;
END;
$$;

-- 7. National overlap rollup RPC across matched province-month sensor pairs
CREATE OR REPLACE FUNCTION public.get_national_overlap(
    p_overlap_years INTEGER[]
)
RETURNS TABLE (
    year INTEGER,
    month INTEGER,
    instrument TEXT,
    active_cell_days INTEGER
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    WITH covered AS (
        SELECT
            mc.region_id,
            mc.year,
            mc.month,
            mc.instrument,
            mc.active_cell_days
        FROM public.monthly_counts mc
        LEFT JOIN public.regions r ON r.id = mc.region_id
        WHERE COALESCE(r.level, 'province') = 'province'
          AND mc.year = ANY(p_overlap_years)
          AND mc.has_coverage = true
    ),
    matched_regions AS (
        SELECT
            c.region_id,
            c.year,
            c.month
        FROM covered c
        WHERE c.active_cell_days > 0
        GROUP BY c.region_id, c.year, c.month
        HAVING COUNT(DISTINCT c.instrument) = 2
    ),
    effective_rows AS (
        SELECT c.year, c.month, c.instrument, c.active_cell_days
        FROM covered c
        INNER JOIN matched_regions m
            ON m.region_id = c.region_id
           AND m.year = c.year
           AND m.month = c.month
        UNION ALL
        SELECT c.year, c.month, c.instrument, c.active_cell_days
        FROM covered c
        WHERE NOT EXISTS (SELECT 1 FROM matched_regions)
    )
    SELECT
        e.year,
        e.month,
        e.instrument,
        SUM(e.active_cell_days)::INTEGER AS active_cell_days
    FROM effective_rows e
    GROUP BY e.year, e.month, e.instrument
    ORDER BY e.year ASC, e.month ASC, e.instrument ASC;
$$;
