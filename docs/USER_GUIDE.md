# FIRE MEMORY — User Guide & CDRRMO Officer Handbook

**Target Audience:** Local Disaster Risk Reduction and Management Offices (**CDRRMO** / **MDRRMO**), Bureau of Fire Protection (**BFP**) field verification teams, environmental analysts, and NASA Space Apps Challenge reviewers.

> **Important Operational Rule:** Every point and count in FIRE MEMORY represents a **satellite thermal anomaly detection** from NASA LANCE FIRMS (`VIIRS 375m` or `MODIS 1km`). A hotspot is **not** automatically a confirmed fire, does **not** predict fire spread, and does **not** replace field verification or official incident-command protocols.

---

## 1. Navigation Overview

Use the left sidebar (marked with the **FIRE MEMORY** flame-and-chip logo) to switch between the four core pages:

| Sidebar Tab | Route | Purpose |
|---|---|---|
| **MAP** | `/` | Interactive Philippine thermal hotspot map, live FIRMS window controls, KPI summary cards, and the right-docked **Advisory AI** drawer. |
| **Calendar** | `/calendar` | Multi-year historical detection matrix organized by UTC calendar month (`Jan`–`Dec`). |
| **Anomaly Detection** | `/anomaly` | Same-month year-by-year bar chart, historical median comparison meter, CDRRMO monitoring posture, and MODIS/VIIRS overlap calibration evidence. |
| **CSV Export** | `/export` | Download bounded GIS hotspot coordinates CSV or historical monthly baseline & anomaly CSV files. |

---

## 2. Using the Satellite Map Workspace (`/`)

### Step 1: Review the Top KPI Summary Cards
Along the top of the map, five frosted summary cards update dynamically for your selected area and time window:
1. **Total Fire Hotspots:** Combined satellite thermal detections (`0.01°` active cell-days or live window count).
2. **Small-Area Sensor (`VIIRS 375m`):** Finer-resolution detections capable of spotting smaller agricultural, brush, or localized heat sources.
3. **Wide-Area Sensor (`MODIS 1km`):** Long-record wide-swath thermal detections providing broader historical continuity.
4. **Typical Baseline (Median):** The historical middle value (**same calendar month only**, e.g., comparing November against past Novembers rather than dry-season months).
5. **Comparison vs. Typical Month:** Percentage deviation against the same-month historical median plus the status badge.

### Step 2: Filter Region, Month, Live Window, or Custom Area
Click the **Map Pin (`Choose region`)** button on the right side of the map to open **Map filters**:
- **Region:** Switch between national **Philippines**, administrative regions, or specific provinces (e.g., **Bukidnon**). You can also click provincial bubbles directly on the map canvas.
- **Month (`UTC`):** Pick any historical `YYYY-MM` period to inspect archive analytics.
- **Live FIRMS period:** Choose `Today`, `7 days`, `Month`, or `Year` to load recent near-real-time detections when `FIRMS_MAP_KEY` is configured (falling back automatically to the latest archive window if upstream FIRMS is unreachable).
- **Metric & Sensor:** Keep **Harmonized** (VIIRS-equivalent scale, default) or switch to **Raw** to filter individually by `All instruments`, `MODIS`, or `VIIRS`.
- **Custom area · grid-approximated:** Expand this section to enter exact `West`, `South`, `East`, `North` bounding-box coordinates or click **Draw rectangle on map** and drag a box anywhere within Philippines bounds.

### Step 3: Read the Map Markers & Hotspot Intensity Scale
- **Clustered Pins:** Click any numbered cluster to zoom into individual thermal detections; click an individual marker to inspect its timestamp (`UTC`), satellite, instrument, confidence, and brightness temperature.
- **Hotspot Intensity Scale (bottom-left legend):**
  - **Low** (`#fb923c`), **Moderate** (`#f97316`), **High** (`#ea580c`), **Very High** (`#ef4444`) — color-coded by sensor brightness and confidence.

---

## 3. Using Advisory AI & Priority Watchlist

Click the **Advisory AI** button on the right side of the map (below the top KPI cards) to open the **CDRRMO Fire Advisory** drawer.

### Tab 1: Advisory (Situational Briefing & Q&A)
1. Confirm the active scope pill (`Region · YYYY-MM` or `Live Window`) and the live KPI strip showing exact `VIIRS` and `MODIS` counts, `Normal Median`, and `Status`.
2. Click **Get CDRRMO Advisory** to generate a three-part structured briefing:
   - **Summary:** Grounded counts reported verbatim from the selected region/period (`VIIRS`, `MODIS`, historical median, and baseline years).
   - **CDRRMO Action:** Sensor-aware guidance translating `VIIRS 375m` (localized brush/field heat) vs. `MODIS 1km` (broader or persistent thermal clusters) readings into BFP and Barangay DRRMC verification focus.
   - **Note:** Explicit data-coverage and non-confirmation caveats.
3. *(Optional)* Expand **Ask a specific question (optional)** to tap a suggested CDRRMO prompt or enter your own question about the active numbers, then click **Ask Advisory**.
   - *Safety Note:* Requests asking to predict fire spread or issue public evacuation orders are refused automatically and redirected to official CDRRMO, BFP, and LGU incident command channels.

### Tab 2: Watchlist
Switch to **Watchlist** to inspect prioritized monitoring sectors:
- When viewing **Philippines** nationally, top high-activity provinces (including **Bukidnon** when active) are listed with one-click **View** buttons to drill straight down.
- When viewing **Bukidnon**, the watchlist highlights three local monitoring corridors: **Northern Bukidnon**, **Central Bukidnon (Malaybalay–Valencia)**, and **Southern Bukidnon (Maramag–Quezon)**.
- Any other province shows localized **Northern**, **Central**, and **Southern** latitude bands computed directly from active hotspots in the window.

---

## 4. Activity Calendar (`/calendar`)

- **Heatmap Grid:** Rows are years and columns are UTC months (`J` through `D`).
- **Distinguishing Missing Data vs. Zero:**
  - Empty / muted **`No data`** cells mean observation coverage was absent or incomplete—never interpreted as zero fires.
  - **`Estimated`** badges indicate MODIS-only historical values scaled to VIIRS-equivalent units.
- **Interactive Inspection:** Click any cell to update the active `YYYY-MM` period across the entire dashboard, inspect year-over-year percentage change (`vs prior year`), and toggle between **Dark** and **Warm** theme modes on the command bar.

---

## 5. Anomaly Detection & Cross-Sensor Calibration (`/anomaly`)

1. **Same-Month Year-by-Year Bar Graph:** Compares the selected calendar month across every available year against the dashed **Typical Median Line**, color-coded by deviation band:
   - **Below Normal**
   - **Near Normal (`±25%`)**
   - **Above Normal (`+25%` to `+75%`)**
   - **Unusually High (`>+75%`)**
2. **CDRRMO Recommended Monitoring Focus:** Translates the anomaly label into clear operational posture badges: `ROUTINE MONITORING`, `STANDARD WATCH`, `ELEVATED CDRRMO WATCH`, `PRIORITY GROUND VERIFICATION`, or `DATA COVERAGE CHECK`.
3. **Overlap Calibration Chart (`OverlapChart`) & Harmonization Panel (`HarmonizationPanel`):**
   - Shows **MODIS Raw**, **MODIS Scaled**, and **VIIRS** side by side over overlap years.
   - Displays the calibration method (`median_monthly_viirs_over_modis`), factor, overlap years, correlation, and validation error percentage transparently so uncertainty is never hidden.

---

## 6. Exporting Intelligence CSVs (`/export`)

Verify the **Active export scope** summary (`Target Area`, `Date Window`, `Metric Mode`, `Sensor`) and choose either download:

1. **Hotspot Coordinates CSV (`Download Hotspot CSV`):**
   - Exports GIS-ready detections capped at `10,000` rows per request (narrow your date window or bounding box if a truncation warning appears).
   - Columns: `id`, `latitude`, `longitude`, `acquisitionDatetime`, `satellite`, `instrument`, `confidence`, `brightness`, `sourceProduct`.
2. **Monthly Baseline & Anomaly CSV (`Download Monthly Baseline CSV`):**
   - Exports multi-year UTC monthly series paired with historical median, anomaly percentage, estimated flag, and classification label.
   - Columns: `year`, `month`, `metric`, `count`, `estimated`, `historicalMedian`, `anomalyPercent`, `label`.
