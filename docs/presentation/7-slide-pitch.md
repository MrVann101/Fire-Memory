# FIRE MEMORY — Seven-Slide Presentation Template

> Replace bracketed placeholders before presenting. The current data figures
> are provisional local aggregates, not a claim of complete NASA coverage.

## Slide 1 — Title & Introduction

**FIRE MEMORY: Historical context for satellite fire detections**

- **Team:** [Team name]
- **Members:** [Member 1], [Member 2], [Member 3], [Member 4]
- **Event:** 2026 NASA Space Apps Challenge — **The Next Frontier**
- **Challenge focus:** Build historical context for changing satellite fire
  observations by harmonizing MODIS and VIIRS data for the Philippines.
- **Study area:** The Philippines, from national view to province drill-down
  such as Bukidnon.

**Opening message:**  
FIRE MEMORY helps people interpret satellite fire detections by comparing a
selected month with the historical pattern for the same place and season.

## Slide 2 — The Problem

### Problem 1 — Sensor records are difficult to compare

MODIS and VIIRS have different resolutions, sensitivities, and observation
schedules. A change in the raw count may reflect a sensor change rather than a
change in activity.

### Problem 2 — Raw maps lack historical context

A map shows where detections occurred, but it does not show whether November
activity is unusual for the same Philippine province compared with previous
Novembers.

### Problem 3 — Missing data can be misleading

Incomplete coverage can look like zero activity, while a satellite detection
can be mistaken for a confirmed fire or a prediction of danger.

**Who it affects:**  
Philippine researchers, environmental analysts, local planners, and
communities that need a defensible historical baseline for satellite
detections—not a fire alarm or emergency directive.

## Slide 3 — The Data & Research

**NASA and partner resources**

- NASA LANCE FIRMS MODIS and VIIRS active-fire products
- NASA FIRMS archive and active-fire attribute documentation
- geoBoundaries Philippines country and ADM2 boundary data
- Supabase/PostgreSQL for regional and monthly analytics storage

**Current local analysis**

- 177,843 source detections in supplied 2020–2025 downloads:
  24,310 MODIS and 153,533 VIIRS.
- 2,539 matched province/month pairs across 72 candidate national months.
- Provisional national VIIRS/MODIS factor: **4.09777677**.
- Leave-one-year-out pooled correlation: **0.99224830**.
- Leave-one-year-out pooled MAPE: **29.20%**.

**Data honesty:**  
The current files document `databaseLoaded=false`; archive and Philippine
coverage metadata remain incomplete. These figures must be labeled provisional.

## Slide 4 — The Solution (Overview)

FIRE MEMORY is a Philippines-focused web dashboard with three solution pillars:

### Solution 1 — A sensor-aware harmonized record

The dashboard preserves raw MODIS and VIIRS counts, then calibrates comparable
observations toward a VIIRS-equivalent scale when coverage supports it. The
factor, correlation, error, and estimated status remain visible.

### Solution 2 — Same-month historical context

Users can move from the national Philippines view to a province such as
Bukidnon, select a month, and compare it with the historical median for that
same month instead of comparing unrelated seasons.

### Solution 3 — Transparent interpretation and export

The interface distinguishes missing coverage from zero, labels detections as
thermal anomalies rather than confirmed fires, provides a grounded Gemini
interpretation, and exports the active hotspot and analytics filters as CSV.

**Safety statement:**  
**Satellite detections, not confirmed fires. Not a prediction.**

## Slide 5 — How It Works (Technical / Architecture)

```text
NASA FIRMS MODIS/VIIRS + Philippine boundaries
            |
            v
   Normalize detections
   UTC month + 0.01° cells
            |
            v
  Compare overlapping records
  VIIRS target + validation error
            |
            v
 Supabase monthly aggregates/API
            |
            +--> Philippines map and province drill-down
            +--> Same-month median calendar and anomaly label
            +--> Grounded Gemini assistant
            +--> Bounded hotspot and analytics CSV
```

**Technology**

- Next.js App Router and React
- TypeScript and Zod validation
- Supabase/PostgreSQL analytics functions
- NASA FIRMS and geoBoundaries data
- Google Gemini server-side API
- Recharts, Leaflet, and CSV export utilities

**AI boundary:**  
The server sends only the typed `AnalyticsSummary` and treats the user
question as untrusted text. It refuses evacuation and spread-prediction
requests and always shows a disclaimer.

## Slide 6 — Impact & Future Potential

**Potential impact**

- Makes sensor changes and uncertainty visible instead of hiding them.
- Gives users a repeatable same-month historical comparison.
- Keeps raw observations, harmonized estimates, and missing coverage distinct.
- Supports research and monitoring workflows without making operational claims.

**Next steps**

- Obtain complete historical archives and Philippine coverage metadata.
- Load and reconcile the validated aggregates in Supabase.
- Re-run province and national validation as additional years and coverage
  metadata become available.
- Improve coverage indicators and custom-area estimates.
- Validate the workflow with local disaster-risk and research users.
- Deploy and test the dashboard with a real end-to-end data path.

## Slide 7 — Team & Conclusion

**Team roles**

- **Member 1:** FIRMS data, boundaries, aggregation, harmonization
- **Member 2:** Supabase, APIs, historical median, anomaly logic
- **Member 3:** Map, filters, calendar, charts, accessibility
- **Member 4:** AI interpretation, exports, presentation

**Conclusion**

FIRE MEMORY turns a changing satellite record into a transparent,
same-month historical comparison for the Philippines. It is a monitoring aid,
not a confirmed-fire database, prediction system, or replacement for official
response channels.

**Thank you**

- Repository: https://github.com/MrVann101/Fire-Memory
- NASA FIRMS: https://earthdata.nasa.gov/firms
- Live demo: [Insert deployed URL]
- Documentation: [Insert final documentation URL]
