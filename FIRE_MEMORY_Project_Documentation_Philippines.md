# FIRE MEMORY

## Historical Fire Intelligence and Decision Support System

**Hackathon:** NASA Space Apps Challenge 2026\
**Event dates:** November 14--15, 2026\
**Prototype focus:** Historical fire activity analysis using MODIS and
VIIRS active-fire observations\
**Primary users:** Emergency responders, local government disaster-risk
offices, fire services, and environmental researchers\
**Geographic scope:** Philippines (nationwide), with province-level
drill-down\
**Suggested drill-down demonstration:** Bukidnon, Northern Mindanao\
**Challenge focus:** A harmonized burning-activity calendar built from
MODIS and VIIRS active-fire hotspots, delivered in a web application
(confirm the exact challenge title on the Space Apps site)

------------------------------------------------------------------------

## 1. Project Overview

**FIRE MEMORY** is a web-based historical fire intelligence and
decision-support platform that turns satellite active-fire observations
into information that is easier to interpret.

The platform combines MODIS and VIIRS hotspot observations in a common
data structure, visualizes where and when hotspots were detected, and
compares current activity with historical patterns for the same period.
It can highlight activity that is above a historical baseline and
provide a concise, data-grounded explanation through an AI assistant.

### One-sentence pitch

> FIRE MEMORY transforms satellite fire observations into historical
> intelligence, helping emergency responders recognize unusual activity
> and make more informed decisions.

### Core message

Don't just show responders where fires are being detected. Show them
whether current activity is unusual, how it compares with historical
patterns, and why the area may deserve closer attention.

### Mission

Turn Earth's fire history into actionable intelligence for a
better-informed response.

------------------------------------------------------------------------

### Challenge alignment

The Space Apps challenge asks teams to (1) **harmonize MODIS and VIIRS
hotspots** into one consistent time series, so that the sensor of origin
matters less and patterns, trends, and anomalies become the focus, and
(2) build a **web application** where a user selects a region and date
range and gets analytics and visualizations, including a **calendar of
burning activity from the early 2000s to the present** and a comparison
of the current month with the **historical median**.

| Challenge ask | How FIRE MEMORY responds |
|---|---|
| Harmonized MODIS + VIIRS series | Grid-based monthly series calibrated on the sensors' overlap years, with validation and limits reported (section 6.3) |
| Calendar from the early 2000s to the present | Monthly aggregates for the full available history (section 6.6) |
| Current month vs historical median | Same-month median and anomaly label (sections 5.3 and 7.3) |
| Region and date range selection | National, province, and custom area (sections 5.1 and 5.6) |
| Downloadable CSV | Hotspot CSV and analytics CSV (section 5.5) |
| Color ramps, accessibility | Colorblind-safe sequential ramp with printed counts (section 5.2) |
| Optional: draw an area or enter lat/long | Custom area tool (section 5.6) |

### Geographic scope

FIRE MEMORY covers the **entire Philippines**. Users start from a national
overview and can narrow to a region or province (for example, Bukidnon) to
inspect local activity. The same historical-median method is applied at
every level: national, regional, and provincial.

------------------------------------------------------------------------

## 2. Problem Statement

Fire is a natural process in many ecosystems, but fire regimes are
changing. Shifts in temperature, rainfall, land use, and other
environmental conditions can affect the frequency, extent, timing, and
intensity of fires.

Satellite instruments such as MODIS and VIIRS detect thermal anomalies
and provide valuable observations for monitoring fire activity. However,
individual hotspot detections can be difficult to interpret without
historical context.

There is also a data-continuity problem. MODIS (on the Terra and Aqua
satellites) provides more than two decades of observations but is
approaching the end of its operational life, and VIIRS is replacing it.
The two records cannot be compared directly, because the instruments
differ in spatial resolution, sensitivity, and observation schedule.
Without harmonization, a change in the number of detections may reflect
a change of sensor rather than a change in fire activity.

A hotspot map may show where detections occurred, but it does not
automatically answer questions such as:

-   Is the current activity unusual for this location and time of year?
-   Which months historically have the most fire detections?
-   Is this month's activity above or below the historical baseline?
-   How has activity changed across previous years?
-   What information should local responders examine more closely?

FIRE MEMORY addresses this interpretation gap by combining a map with
historical summaries, comparisons, and clear explanations.

------------------------------------------------------------------------

## 3. Proposed Solution

FIRE MEMORY is a web application that allows users to:

1.  View MODIS and VIIRS active-fire hotspot observations on an
    interactive map.
2.  Select a geographic area (national, province, or a custom area
    drawn on the map or entered as coordinates) and a date range.
3.  Explore a harmonized monthly burning-activity calendar built from
    MODIS and VIIRS, from the early 2000s to the present where data is
    available.
4.  Compare a selected period with the historical median for the same
    calendar period.
5.  Identify activity that is above its historical baseline.
6.  Ask an AI assistant to explain calculated results using the supplied
    data.
7.  Export filtered hotspot records and an analytics file (monthly
    counts, medians, and anomalies) for further review.

The application is intended as a decision-support and information tool.
Satellite hotspot detections are observations that may require ground
verification; they are not, by themselves, confirmation of a fire
incident or a complete measure of fire danger.

------------------------------------------------------------------------

## 4. Target Users

-   **Municipal and Provincial Disaster Risk Reduction and Management
    Offices (MDRRMO/PDRRMO):** Review historical patterns and identify
    areas or periods that may need closer monitoring.
-   **Bureau of Fire Protection (BFP) and response teams:** Use hotspot
    observations and historical context as supplementary situational
    information.
-   **Local government units:** Understand seasonal activity and support
    preparedness discussions.
-   **Environmental researchers and students:** Explore historical
    satellite fire observations and compare patterns across periods.

------------------------------------------------------------------------

## 5. Core Features

### 5.1 Live Fire Intelligence Map

An interactive map displays available MODIS and VIIRS hotspot
observations.

**Planned capabilities:** - Plot hotspot locations as map markers. -
Filter by date range and satellite/instrument. - Select or search for a
region. - Show available record details, such as: - Latitude and
longitude - Acquisition date and time - Satellite or sensor source -
Confidence, where supplied - Brightness or other thermal attributes,
where supplied - Display hotspot clusters when useful for readability. At national
scale, clustering (or aggregation by province/grid cell at low zoom
levels) is required to keep the map responsive.

**Important:** The map displays satellite detections. It should not
label every detection as a confirmed fire without independent
verification.

### 5.2 Historical Fire Calendar

A calendar-style heatmap summarizes hotspot counts by month and year.

**Planned capabilities:** - Show historical monthly activity. - Make
seasonal patterns easier to recognize. - Identify months with relatively
high or low detection counts. - Compare patterns across years. - Let
users select a month or year to inspect the corresponding observations.

The calendar should clearly state the time period and geographic area
represented.

**Harmonized and raw views:** The calendar shows the **harmonized**
series by default. A toggle switches to the **raw** counts, where the
sensor filter applies. Months that were converted from MODIS to a
VIIRS-equivalent value are marked as **estimated**. Months without data
coverage are shown as "No data" and are never drawn as zero.

**Accessible color ramp:** Use a colorblind-safe sequential ramp (for
example viridis or a ColorBrewer sequential ramp), a visible legend, and
the count printed in each cell or available on focus. Do not rely on
color alone.

### 5.3 Fire Anomaly Detection

This feature compares the selected period's hotspot count with the
historical median for the same calendar period and selected region.

A simple comparison is:

\[ `\text{Anomaly \%}`{=tex} =
`\frac{\text{Current Count} - \text{Historical Median}}`{=tex}
{`\text{Historical Median}`{=tex}} `\times 100`{=tex} \]

For example, compare the current November count with the historical
November counts for the selected region, rather than comparing November
with a baseline made from all months.

**Suggested interpretation labels:** - **Below baseline:** Current count
is lower than the historical median. - **Near baseline:** Current count
is close to the historical median. - **Above baseline:** Current count
is higher than the historical median. - **Unusually high:** Current
count is substantially above the baseline, based on a documented
threshold.

These labels describe differences in observed hotspot counts. They are
not official fire-danger ratings, forecasts, or proof of an emergency.

**Edge case:** If the historical median is zero, the percentage formula
is undefined. In that case, show the current count and explain that a
percentage anomaly cannot be calculated using a zero baseline. Do not
divide by zero.

### 5.4 AI Fire Intelligence Assistant

A Gemini-powered assistant explains the analytics in plain language.

**Possible questions:** - "Summarize the fire activity in this region
this month." - "How does this month compare with the historical
median?" - "Which months usually have the most hotspot detections?" -
"Explain why this period is above its historical baseline."

**AI responsibilities:** - Summarize only the statistics and
observations supplied by the application. - Explain comparisons in
accessible language. - Mention the selected region and date range. -
State limitations and uncertainty. - Distinguish satellite detections
from confirmed incidents.

**AI safety and data-grounding rules:** - Never invent hotspot counts,
dates, locations, or sensor information. - Never claim that a hotspot is
a confirmed fire unless verified data supports that statement. - Never
present a simple count anomaly as a fire prediction. - Never issue
unsupported evacuation instructions or emergency directives. - If the
available data is incomplete, stale, or insufficient, say so. - Keep the
computed analytics separate from AI-generated interpretation.

### 5.5 Emergency Intelligence Report

Users can export a concise summary for a selected region and date range.

**Planned report contents:** - Selected region and date range - Data
source and retrieval period - Total hotspot detections - Breakdown by
sensor, where available - Historical calendar or chart - Historical
median comparison - Anomaly percentage or an explanation of why it
cannot be calculated - Map or map snapshot, if feasible - AI-generated
summary clearly labeled as an interpretation - Data limitations and
verification reminder

**Export priorities:** 1. CSV export of filtered hotspot records 2.
Analytics CSV (monthly counts, historical medians, anomalies, and the
harmonization notes) 3. A concise downloadable report (PDF) if time
permits

### 5.6 Custom Area of Interest

Besides national and province selection, users can define their own area
by drawing a rectangle on the map or entering latitude and longitude
bounds.

-   Province counts cannot answer a freehand area, so the application
    keeps a coarser **grid summary** (about 0.1 degree cells, roughly 11
    km) of monthly counts for the full history. A custom area sums the
    cells inside it.
-   Results for custom areas are **approximate** and must be labeled
    "grid-approximated". The harmonization factor used is the national
    factor.
-   This feature is a Should Have item, not required for the first demo.

------------------------------------------------------------------------

## 6. Data Sources and Data Handling

### 6.1 NASA FIRMS

The proposed source for active-fire observations is **NASA Fire
Information for Resource Management System (FIRMS)**.

FIRMS provides active-fire and thermal-anomaly observations from
satellite instruments, including MODIS and VIIRS. The team should use
the relevant official FIRMS products and documentation to confirm
product names, fields, access requirements, update frequency, and
licensing/attribution requirements before implementation.

For nationwide coverage, check whether FIRMS offers a country-level
download or API filter for the Philippines, or use a bounding box
covering the archipelago and then filter by the Philippine boundary.
Confirm API request-size and day-range limits in the current
documentation before planning the ingestion strategy.

Official resource: - NASA FIRMS: https://firms.modaps.eosdis.nasa.gov/

### 6.2 MODIS and VIIRS

MODIS and VIIRS are different satellite instruments. Their observations
are not automatically interchangeable.

They differ in factors such as: - Spatial resolution - Detection
sensitivity - Observation timing and frequency - Product characteristics
and confidence fields - The way detections are represented

For this reason, simply appending MODIS rows and VIIRS rows into one
table and treating every detection as equivalent would be misleading.

### 6.3 Harmonization Method (Core of the Project)

**Goal:** produce one consistent monthly series from MODIS and VIIRS so
that patterns, trends, and anomalies can be compared across the full
history, and **prove how well it works**.

**Honesty rule:** do not claim that the two sensors are equivalent.
Claim a harmonized series together with its validation results and its
limits.

**Step A: Record-level preparation**

1.  Retrieve the selected MODIS and VIIRS active-fire records.
2.  Normalize shared fields into one consistent schema.
3.  Preserve the original sensor identity for every record.
4.  Normalize dates and times to UTC.
5.  Keep sensor-specific fields when they are not directly comparable.
6.  Document any filtering or deduplication. Do not delete nearby points
    from different sensors (see section 6.4).

**Step B: Normalize spatial resolution**

VIIRS detections are much finer than MODIS detections, so raw point
counts are not comparable. Use a fixed grid of about 0.01 degrees
(roughly 1 km) and count **active grid cell-days**: a cell counts once
per UTC day if the sensor detected at least one hotspot in it. Do this
for both sensors. The grid reduces, but does not remove, the difference
between the instruments.

**Step C: Monthly aggregation**

For each province, year, month, and sensor, store the raw hotspot count
and the active grid cell-days. Also store the same values per 0.1 degree
cell for custom areas (section 5.6).

**Step D: Calibrate on the overlap years**

1.  Identify the years in which both sensors operate (verify the
    dates in the FIRMS documentation).
2.  Choose **VIIRS as the target sensor**, because it provides
    continuity going forward.
3.  Estimate a factor that converts MODIS active cell-days into
    VIIRS-equivalent values. The default is the median of monthly
    VIIRS/MODIS ratios over overlap months with enough MODIS activity.
    A regression through the origin is an alternative. Record which
    method is used.
4.  Use one factor per province when there are enough overlap months;
    otherwise use a national factor. Document the minimum.

**Step E: Build the harmonized series**

-   Where VIIRS is operating, use the VIIRS value.
-   Before VIIRS, use the MODIS value multiplied by the factor, and mark
    it **estimated**.

**Step F: Validate**

1.  Compare scaled MODIS with VIIRS over the overlap years (correlation
    and error percentage).
2.  Run a **leave-one-year-out test**: calibrate without one year,
    predict that year, and measure the error.
3.  Run an **anomaly-consistency check**: compute the current month's
    anomaly label using only MODIS history and again using only VIIRS
    history. If the labels differ, show a warning.

**Step G: Report**

Publish a harmonization summary with the method, target sensor, overlap
years, factor, correlation, error, the list of estimated years, and
notes. Show it in the application and in `docs/HARMONIZATION.md`.

**Known limitations to disclose**

-   The factor is assumed to be stable over time.
-   Overpass times and detection sensitivity differ between sensors.
-   Provinces with few detections give noisy factors.
-   VIIRS data may come from more than one satellite, and each has its
    own start date. Treat VIIRS as a group and verify start dates.
-   Pre-VIIRS values are estimates, not observations.

**Fallback if time is short:** use a single national factor and only the
overlap years. This is still a real, demonstrable harmonization.

### 6.4 Deduplication Caution

Nearby detections from different sensors or different observation times
may represent: - The same underlying fire activity observed more than
once, or - Distinct detections that should remain separate.

Do not automatically delete nearby points. If deduplication is used,
document the spatial and temporal thresholds, preserve source records,
and explain that the method is an approximation.

### 6.5 Data Quality and Attribution

The application should: - Show the data source and observation period. -
Preserve the original sensor/source fields. - Handle missing values
without fabricating replacements. - Distinguish missing values from zero
values. - Display the last successful data update. - Follow NASA FIRMS
attribution and usage requirements. - Avoid presenting incomplete data
as a complete record of all fires.

### 6.6 Historical Depth and Storage

The challenge asks for a calendar from the early 2000s to the present.
Loading every historical point for the whole country is not practical, so
store data in two tiers.

| Tier | Contents | Used for |
|---|---|---|
| Raw points (`hotspots`) | A recent window only (for example the last 12 to 24 months, plus the demo months) | The map and the hotspot CSV |
| Monthly aggregates (`monthly_counts`, `monthly_harmonized`, `monthly_grid_counts`) | The full available history, per province, month, and sensor | The calendar, the median, anomalies, and custom areas |

Process the archive files one year at a time: read the file, assign
provinces, aggregate, write only the aggregates, and discard the raw rows.
Check the FIRMS documentation for the earliest available date of each
sensor and request the archive downloads early, because large requests
can take time. If access is slow, load in this order: (1) both sensors
for the overlap years, (2) MODIS back toward the early 2000s, (3) the
remaining recent VIIRS data.

------------------------------------------------------------------------

## 7. Analytics Methodology

### 7.1 Geographic Aggregation

The prototype supports three geographic levels: **national**
(Philippines), **region/province**, and optionally municipality if time
permits. For the selected level, include records whose coordinates fall
within the selected boundary.

A simple bounding box around the Philippines would also capture
detections from neighboring areas (for example, parts of Malaysia,
Indonesia, and Taiwan) and ocean pixels. Use the Philippine national
boundary for the national view and administrative boundaries for
provinces. If a simplified bounding box is used for any level, label it
accurately.

Province-level counts should sum consistently with the national count.
Decide and document how detections near borders or coastlines are
assigned.

### 7.2 Time Aggregation

Group detections by a consistent time interval, such as month and year.
Apply the same time-zone convention throughout the data pipeline. UTC is
recommended for stored acquisition timestamps, with local-time
conversion handled for display when appropriate.

### 7.3 Historical Median

For a selected region and calendar month:

1.  Collect the monthly counts for that same month across the available
    historical years (by default the **harmonized** series, from the
    early 2000s where data exists). Estimated years are labeled.
2.  Calculate the median of those yearly counts.
3.  Compare the current period's count with that median.
4.  Display the number of historical years used in the baseline.

The baseline should not silently include the current incomplete month as
if it were a complete historical year. If the available historical
sample is small, display that limitation.

### 7.4 Anomaly Interpretation

A count above the historical median means the number of satellite
detections is higher than the median for the comparison period. It does
not necessarily mean the fires are larger, more intense, more dangerous,
or more damaging.

Interpretation should consider: - Number of historical years available -
Sensor mix and sensor-specific differences - Data completeness -
Seasonal and geographic context - Potential changes in observation
coverage or processing

------------------------------------------------------------------------

## 8. Suggested Technology Stack

The following stack is recommended to keep development practical and
align with the team's existing web-development experience.

  -----------------------------------------------------------------------
  Layer                   Technology              Purpose
  ----------------------- ----------------------- -----------------------
  Frontend                Next.js + TypeScript    Web application

  Styling                 Tailwind CSS +          Responsive interface
                          shadcn/ui               and components

  Backend                 Next.js API routes      Data access and
                                                  application logic

  Database                Supabase PostgreSQL     Store normalized
                                                  hotspot records and
                                                  region metadata

  Map                     Leaflet + OpenStreetMap Interactive hotspot map

  Charts                  Recharts                Historical calendar
                                                  summaries and analytics
                                                  charts

  AI                      Gemini API              Data-grounded
                                                  explanations and
                                                  regional briefings

  Satellite data          NASA FIRMS              MODIS and VIIRS
                                                  active-fire
                                                  observations

  CSV                     Native JavaScript or a  Export filtered
                          CSV utility             observations

  PDF (optional)          jsPDF                   Generate downloadable
                                                  reports

  Deployment              Vercel                  Host the web
                                                  application
  -----------------------------------------------------------------------

Use official documentation for setup and API details. Keep API keys on
the server and never expose secret keys in client-side code or a public
repository.

------------------------------------------------------------------------

## 9. Suggested Database Design

The schema below is a starting point. Adjust field types and required
fields to match the actual FIRMS product being ingested.

### 9.1 `hotspots`

  ------------------------------------------------------------------------
  Field                    Suggested type          Description
  ------------------------ ----------------------- -----------------------
  `id`                     UUID                    Internal record ID

  `latitude`               DOUBLE PRECISION        Detection latitude

  `longitude`              DOUBLE PRECISION        Detection longitude

  `acquisition_datetime`   TIMESTAMPTZ             Observation date and
                                                   time

  `satellite`              TEXT                    Satellite identifier

  `instrument`             TEXT                    Instrument, such as
                                                   MODIS or VIIRS

  `confidence`             TEXT or NUMERIC         Original confidence
                                                   value, preserving
                                                   product semantics

  `brightness`             DOUBLE PRECISION        Brightness value, if
                                                   supplied

  `source_id`              TEXT                    Original source record
                                                   identifier, if
                                                   available

  `source_product`         TEXT                    Product name/version,
                                                   if available

  `ingested_at`            TIMESTAMPTZ             Time the application
                                                   ingested the record
  ------------------------------------------------------------------------

Consider a uniqueness constraint using an appropriate source identifier
or a carefully designed source-record key to prevent accidental
duplicate ingestion. Do not assume latitude and longitude alone uniquely
identify a detection.

Add a nullable `province_id UUID` column, filled during ingestion, so
nationwide queries stay fast. The `hotspots` table holds only the recent
raw window (see section 6.6).

### 9.2 `regions`

  Field        Suggested type          Description
  ------------ ----------------------- -------------------------
  `id`         UUID                    Region ID
  `name`       TEXT                    Region name
  `level`      TEXT                    country, region, or province
  `parent_id`  UUID                    Parent region (nullable), e.g.
                                       province to region to country
  `province`   TEXT                    Province, if applicable
  `country`    TEXT                    Country
  `boundary`   JSONB or spatial type   Geographic boundary

For a more robust implementation, use PostGIS geometry/geography types
if available and the team can configure them quickly. Otherwise, a
simplified region boundary representation may be sufficient for the
prototype.

### 9.3 `fire_analytics` (Optional)

  -----------------------------------------------------------------------
  Field                   Suggested type          Description
  ----------------------- ----------------------- -----------------------
  `id`                    UUID                    Analytics record ID

  `region_id`             UUID                    Selected region

  `year`                  INTEGER                 Calendar year

  `month`                 INTEGER                 Calendar month

  `hotspot_count`         INTEGER                 Count for the period

  `historical_median`     DOUBLE PRECISION        Historical baseline

  `anomaly_percentage`    DOUBLE PRECISION        Calculated percentage,
                                                  nullable

  `generated_at`          TIMESTAMPTZ             Calculation timestamp
  -----------------------------------------------------------------------

For the hackathon MVP, calculate analytics dynamically if the dataset is
small enough. Avoid storing derived values until the team has a clear
reason to cache them.

### 9.4 `monthly_counts`

  ------------------------------------------------------------------------
  Field                  Suggested type          Description
  ---------------------- ----------------------- -------------------------
  `region_id`            UUID                    Province or country

  `year`                 INTEGER                 Calendar year (UTC)

  `month`                INTEGER                 Calendar month (UTC)

  `instrument`           TEXT                    MODIS or VIIRS

  `raw_count`            INTEGER                 Hotspot detections

  `active_cell_days`     INTEGER                 Active 0.01 degree
                                                 cell-days

  `has_coverage`         BOOLEAN                 False when the sensor had
                                                 no data for that month
  ------------------------------------------------------------------------

Unique on (`region_id`, `year`, `month`, `instrument`).

### 9.5 `monthly_harmonized`

  ------------------------------------------------------------------------
  Field                  Suggested type          Description
  ---------------------- ----------------------- -------------------------
  `region_id`            UUID                    Province or country

  `year`, `month`        INTEGER                 Calendar period (UTC)

  `harmonized_count`     DOUBLE PRECISION        VIIRS-equivalent value,
                                                 nullable

  `is_estimated`         BOOLEAN                 True when converted from
                                                 MODIS

  `method_version`       TEXT                    Version of the method
  ------------------------------------------------------------------------

### 9.6 `monthly_grid_counts`

  ------------------------------------------------------------------------
  Field                  Suggested type          Description
  ---------------------- ----------------------- -------------------------
  `cell_id`              TEXT                    0.1 degree cell key

  `cell_lat`, `cell_lon` DOUBLE PRECISION        Cell center

  `year`, `month`        INTEGER                 Calendar period (UTC)

  `instrument`           TEXT                    MODIS or VIIRS

  `raw_count`            INTEGER                 Detections in the cell

  `active_cell_days`     INTEGER                 Active fine-grid
                                                 cell-days in the cell
  ------------------------------------------------------------------------

### 9.7 `harmonization_factors`

  ------------------------------------------------------------------------
  Field                  Suggested type          Description
  ---------------------- ----------------------- -------------------------
  `region_id`            UUID                    Province, or null for
                                                 the national factor

  `factor`               DOUBLE PRECISION        MODIS to VIIRS-equivalent

  `method`               TEXT                    For example median ratio

  `overlap_years`        INTEGER[]               Years used

  `n_months`             INTEGER                 Overlap months used

  `correlation`          DOUBLE PRECISION        Scaled MODIS vs VIIRS

  `error_percent`        DOUBLE PRECISION        Validation error

  `computed_at`          TIMESTAMPTZ             Calculation time
  ------------------------------------------------------------------------

------------------------------------------------------------------------

## 10. Main User Flow

1.  The user opens the FIRE MEMORY dashboard.
2.  The user views the national (Philippines) overview and optionally
    selects a region or province, such as Bukidnon.
3.  The user selects a date range or calendar month.
4.  The application retrieves the corresponding MODIS and VIIRS
    observations.
5.  The map displays the filtered hotspot records.
6.  The historical calendar summarizes activity across years.
7.  The analytics module calculates the selected period's count and
    historical median.
8.  The dashboard displays the comparison and an appropriately qualified
    interpretation.
9.  The user asks the AI assistant to explain the supplied analytics.
10. The user exports the filtered records or report.

------------------------------------------------------------------------

## 11. Suggested Interface Structure

### Dashboard

-   Application name and short description
-   Region selector (Philippines national view plus region/province
    drill-down)
-   Date-range selector
-   Sensor filter
-   Summary cards: total detections, MODIS count, VIIRS count,
    historical median
-   Interactive map
-   Historical activity calendar
-   Anomaly comparison panel
-   AI intelligence assistant
-   Export controls

### Design Direction

Use a clean, professional geospatial dashboard rather than a flashy
AI-themed interface.

Suggested visual direction: - Neutral dark navy, charcoal, or light
background - Clear map contrast - Accessible colors for hotspot markers
and chart intensity - Consistent spacing and readable typography -
Compact data cards - Clear labels for sensor source and data freshness -
Responsive layout for laptop and mobile screens

Avoid relying on color alone to communicate anomaly status. Pair colors
with labels and icons or text descriptions.

------------------------------------------------------------------------

## 12. Two-Day Hackathon MVP

The team has limited time, so the priority is a reliable working
demonstration rather than a large feature set.

### Must Have

-   [ ] Obtain real NASA FIRMS sample data for MODIS and VIIRS.
-   [ ] Normalize the records into a common schema.
-   [ ] Preserve sensor/source identity.
-   [ ] Display hotspot records on an interactive map.
-   [ ] Add region and date filters.
-   [ ] Show a historical monthly activity calendar or equivalent chart.
-   [ ] Calculate a historical median for the same calendar period.
-   [ ] Display a clear above/below/near-baseline comparison.
-   [ ] Build the **harmonized monthly series** (MODIS converted to a
    VIIRS-equivalent value using overlap-year calibration) and report the
    validation results.
-   [ ] Provide monthly history from the **early 2000s** where data is
    available (aggregates, not raw points).
-   [ ] Offer a raw versus harmonized view, with estimated months clearly
    marked.
-   [ ] Explain data limitations, the harmonization method, its
    validation, and its limits.

### Should Have

-   [ ] Gemini-powered regional briefing grounded in calculated
    statistics.
-   [ ] Basic summary charts and sensor breakdown.
-   [ ] CSV export of filtered hotspot records.
-   [ ] Last-updated timestamp and data-source attribution.
-   [ ] Custom area of interest (draw a rectangle or enter coordinates).
-   [ ] Analytics CSV (monthly counts, medians, anomalies).
-   [ ] Colorblind-safe color ramp with legend and printed counts.

### Nice to Have

-   [ ] PDF report.
-   [ ] Saved monitoring regions.
-   [ ] Historical playback.
-   [ ] Email notifications.
-   [ ] More advanced clustering or spatial analysis.

If time becomes limited, prioritize correct data handling and a complete
map-to-analysis flow over optional features.

------------------------------------------------------------------------

## 13. Suggested 48-Hour Development Plan

### Day 1: Data and Core Dashboard

**Hours 1--3: Data access and inspection** - Confirm FIRMS access and
product selection. - Download or retrieve sample MODIS and VIIRS
records. - Inspect actual field names, timestamps, confidence values,
and missing data. - Create a small, reproducible sample for development. - **Request the FIRMS archive
downloads for the Philippines right away** (large requests take time) and
confirm each sensor's earliest date and the overlap years. Decide the raw
point window (recent months only) and plan monthly aggregates for the
full history (section 6.6).

**Hours 3--7: Data pipeline and database** - Define the common schema. -
Normalize records. - Preserve source/sensor fields. - Set up Supabase
tables and ingestion. - Check for duplicate imports and invalid
coordinates.

**Hours 7--16 (parallel with the map work): Harmonization** - Aggregate
each archive year into monthly counts and active grid cell-days per
province and sensor. - Compute the overlap-year factor and the validation
results (correlation, error, leave-one-year-out, anomaly consistency). -
Build the harmonized monthly series and mark estimated months. - Write
`docs/HARMONIZATION.md`. - Start with one province and the overlap years,
then widen.

**Hours 7--12: Map and filters** - Build the main dashboard layout. -
Add the Leaflet map. - Plot hotspot records. - Add region, date, and
sensor filters. - Verify that the filters affect both the map and
summary values.

**Hours 12--24: Historical analytics** - Aggregate counts by month and
year. - Build the historical calendar or chart. - Calculate same-month
historical medians. - Add anomaly interpretation and edge-case handling.

### Day 2: AI, Export, Testing, and Presentation

**Hours 24--29: AI briefing** - Prepare a structured analytics
payload. - Send only computed results and relevant context to Gemini. -
Add prompt instructions to prevent invented values or unsupported
emergency advice. - Test the assistant against several regions and date
ranges.

**Hours 29--34: Export** - Implement CSV export first. - Ensure export
uses the same active filters as the dashboard. - Add PDF only if the
core application is stable.

**Hours 34--40: Integration and validation** - Test data ingestion and
filtering. - Check counts against source records. - Verify historical
comparison logic. - Test missing values and zero historical baselines. -
Check mobile/laptop layout and error states.

**Hours 40--48: Deployment and demo preparation** - Deploy the
application. - Test the deployed version and API configuration. -
Prepare slides and a short demo script. - Rehearse the full user flow. -
Prepare a fallback dataset or recorded screenshots in case live data
access fails.

------------------------------------------------------------------------

## 14. Suggested Team Division

For a four-person team:

  -----------------------------------------------------------------------
  Role                                Responsibility
  ----------------------------------- -----------------------------------
  1\. Data and FIRMS                  Retrieve MODIS/VIIRS data, inspect
                                      fields, normalize records, build
                                      monthly aggregates, calibrate and
                                      validate the harmonization

  2\. Backend and Analytics           Supabase, API routes, aggregation,
                                      historical median on the
                                      harmonized series, anomaly
                                      calculation

  3\. Frontend and Mapping            Dashboard, Leaflet map, filters,
                                      calendar, raw/harmonized toggle,
                                      charts, custom area tool

  4\. AI, Export, and Presentation    Gemini integration, CSV/report
                                      export, testing support, demo and
                                      pitch
  -----------------------------------------------------------------------

If the team has fewer members, combine roles based on experience. Agree
on the data schema and API response shape early so frontend and backend
work can proceed in parallel.

------------------------------------------------------------------------

## 15. Demonstration Scenario: Philippines (with Bukidnon Drill-Down)

Use the Philippines as the demonstration scope, with Bukidnon as a
locally relevant drill-down, if actual FIRMS records are available for the
selected periods.

### Demo sequence

1.  Open the FIRE MEMORY dashboard on the national (Philippines) view.
2.  Choose a month with available current and historical observations.
3.  Show the MODIS and VIIRS hotspot observations across the country
    (clustered).
4.  Open the harmonized historical calendar to show the same month
    across previous years nationally, then toggle to the raw view to show
    the effect of the sensor change and point out the estimated months.
5.  Point out the national current count and historical median, and
    explain whether it is below, near, or above the baseline.
6.  Drill down to a province (for example, Bukidnon) and show how the
    local picture compares with the national one.
7.  Ask the AI assistant: "Explain this month's fire activity compared
    with previous years."
8.  Generate or download the CSV/report.

Use real observations wherever possible. If simulated data is used for a
UI demonstration, label it clearly as simulated and never present it as
NASA satellite data.

### Example AI question

> Explain the selected region's hotspot activity this month. Compare the
> current count with the historical median for the same month, describe
> the main data limitations, and avoid making predictions or emergency
> recommendations.

------------------------------------------------------------------------

## 16. Project Pitch

### Short pitch

FIRE MEMORY is a historical fire intelligence platform for the
Philippines that combines MODIS and VIIRS satellite hotspot observations into a unified view. It
helps users explore fire activity over time, compare current
observations with historical patterns, and identify periods with
unusually high hotspot counts. With interactive maps, historical
analytics, and AI-generated explanations grounded in actual data, FIRE
MEMORY supports better-informed monitoring and decision-making.

### Problem / Solution / Impact

**Problem:** Satellite hotspot maps show detections, but responders may
lack the historical context needed to understand whether current
activity is unusual.

**Solution:** FIRE MEMORY combines satellite observations, historical
calendars, baseline comparisons, and AI-assisted explanations in one web
application.

**Intended impact:** Make historical fire information easier to explore
and interpret, supporting preparedness, monitoring, and informed
discussion by local decision-makers.

### What the project does not claim

-   It does not predict exactly where a wildfire will start.
-   It does not replace field verification or official emergency
    systems.
-   It does not establish fire severity from hotspot counts alone.
-   It does not claim MODIS and VIIRS are perfectly equivalent.
    Harmonized values for MODIS-only years are estimates with a stated
    error.
-   It does not automatically determine whether an area is safe or
    unsafe.

------------------------------------------------------------------------

## 17. Risks and Mitigation

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  FIRMS access or API issues          Test access early; keep a clearly
                                      labeled sample dataset as a
                                      fallback

  Different MODIS and VIIRS           Preserve sensor identity,
  characteristics                     harmonize with overlap-year
                                      calibration, and report the
                                      validation and its limits

  Missing or incomplete observations  Display data coverage and avoid
                                      treating missing data as zero

  Incorrect historical comparison     Compare the same calendar period
                                      and show the number of baseline
                                      years

  Zero historical median              Do not calculate percentage
                                      anomaly; show counts and explain
                                      the edge case

  AI invents or overstates            Supply computed statistics,
  conclusions                         constrain the prompt, and label AI
                                      text as interpretation

  Duplicate ingestion                 Use source identifiers or a
                                      documented record key and test
                                      repeated imports

  Nationwide data volume slows        Limit the history range, index by
  ingestion, queries, or the map      date and region, aggregate for the
                                      national view, and cluster map markers

  Region assignment errors            Use real administrative boundaries,
  (borders, coastlines)               document the assignment method, and
                                      check that provincial counts sum to
                                      the national count

  Harmonization factor is unstable    Use a national factor, report the
  or validation is weak               error honestly, mark estimated
                                      months, and show the raw view

  Archive downloads are slow or       Request them first, process one year
  too large                           at a time, store aggregates only,
                                      and load overlap years first

  Scope too large for 48 hours        Complete the map, filters,
                                      calendar, and baseline before
                                      optional features
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 18. Final Development Priorities

If the team has very little time remaining, work in this order:

1.  **Data correctness:** Real source records, normalized fields,
    preserved sensor identity, and the harmonized monthly series with
    its validation.
2.  **Historical calendar:** Show monthly counts across years.
3.  **Anomaly analysis:** Compare the selected period against the
    same-period historical median.
4.  **Interactive map:** Show the records that correspond to the
    selected filters.
5.  **AI briefing:** Explain computed results without inventing facts.
6.  **CSV export:** Let users retrieve the filtered records.
7.  **PDF and extras:** Only after the core flow works.

A smaller, accurate prototype is stronger than a larger application that
makes unsupported claims.

------------------------------------------------------------------------

## 19. References and Useful Resources

-   NASA Fire Information for Resource Management System (FIRMS):
    https://firms.modaps.eosdis.nasa.gov/
-   NASA FIRMS documentation and data access information:
    https://firms.modaps.eosdis.nasa.gov/content/academy/
-   NASA Earthdata: https://www.earthdata.nasa.gov/
-   Next.js documentation: https://nextjs.org/docs
-   Supabase documentation: https://supabase.com/docs
-   Leaflet documentation: https://leafletjs.com/reference.html
-   Recharts documentation: https://recharts.org/
-   Google AI for Developers (Gemini): https://ai.google.dev/

Check current official documentation for data product details, access
requirements, API limits, and attribution before the final submission.

------------------------------------------------------------------------

## 20. Project Status Checklist

Use this checklist to track implementation progress.

### Data

-   [ ] FIRMS access confirmed
-   [ ] MODIS sample data retrieved
-   [ ] VIIRS sample data retrieved
-   [ ] Common schema defined
-   [ ] Sensor identity preserved
-   [ ] Data normalization tested
-   [ ] Duplicate-ingestion behavior checked
-   [ ] Overlap years confirmed from FIRMS documentation
-   [ ] Monthly aggregates loaded from the early 2000s (where available)
-   [ ] Harmonization factor calculated and validation reported
-   [ ] Harmonization limitations documented

### Application

-   [ ] Supabase configured
-   [ ] Backend/API routes working
-   [ ] Interactive map working
-   [ ] Philippine national boundary and province boundaries loaded
-   [ ] National-to-province drill-down working
-   [ ] Region filter working
-   [ ] Date-range filter working
-   [ ] Sensor filter working
-   [ ] Historical calendar working
-   [ ] Historical median calculation verified
-   [ ] Anomaly labels and edge cases handled
-   [ ] CSV export working
-   [ ] Raw and harmonized toggle working
-   [ ] Custom area (draw or coordinates) working
-   [ ] Analytics CSV working
-   [ ] Accessible color ramp and legend in place

### AI and Reporting

-   [ ] Gemini API configured securely
-   [ ] AI receives computed analytics
-   [ ] AI does not invent missing values
-   [ ] AI limitations are stated
-   [ ] Regional briefing tested
-   [ ] Report/PDF completed if time permits

### Final Submission

-   [ ] Application deployed
-   [ ] Deployed app tested
-   [ ] Data source attribution visible
-   [ ] Demo scope (Philippines) and drill-down province/date range
    selected
-   [ ] Presentation prepared
-   [ ] Demo rehearsed
-   [ ] Fallback demo data clearly labeled

------------------------------------------------------------------------

**FIRE MEMORY --- Turn Earth's fire history into actionable intelligence
for a better-informed response.**
