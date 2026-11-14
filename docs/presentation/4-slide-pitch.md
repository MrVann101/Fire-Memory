# FIRE MEMORY four-slide pitch

**Status:** draft for the 2026 NASA Space Apps Challenge. Replace every
`VERIFY` item before submission. Never replace a placeholder with a simulated
number presented as NASA data.

## Slide 1 — Challenge and problem (45 seconds)

**Title:** FIRE MEMORY: historical context for satellite fire detections

**On-slide content:**

- Official challenge: **VERIFY the exact challenge title on the submission
  page.**
- MODIS provides a long record; VIIRS provides finer, continuing
  observations.
- Their counts cannot be compared directly because the sensors differ in
  resolution, sensitivity, and observation schedule.
- A map shows where detections occurred, but not whether this month is
  unusual for the same place and season.
- Real project number: **VERIFY — insert one value from the final
  validation report**, such as the number of available history years,
  overlap months, or a measured correlation.

**Speaker notes:**

“Satellite maps are useful, but a count without historical context is hard to
interpret. A change in detections can reflect a sensor change rather than a
change in activity. FIRE MEMORY addresses that continuity problem for the
Philippines by combining the long MODIS record with VIIRS and showing the
comparison honestly. The number on this slide must come from our final data
validation, not from a mock.”

## Slide 2 — Solution and validity (60 seconds)

**Title:** One harmonized calendar, with its uncertainty visible

**On-slide content:**

1. Normalize MODIS and VIIRS records while preserving their source.
2. Count active 0.01-degree grid cell-days by UTC month.
3. Calibrate MODIS to a VIIRS-equivalent scale using overlap years.
4. Compare the selected month with the same-month historical median.
5. Show raw and harmonized views, estimated months, coverage gaps, factor,
   correlation, and error.

**Required callout:**  
**Satellite detections, not confirmed fires. Not a prediction.**

**Speaker notes:**

“The harmonized series is not a claim that the instruments are equivalent. It
is a documented calibration: VIIRS is the target, MODIS-only months are
estimated, and the application reports the factor and validation error. The
median compares November with previous Novembers, rather than comparing one
season with every month.”

## Slide 3 — Demonstration (2 minutes 30 seconds)

**Title:** From national context to a province-level question

**Demo checkpoints:**

1. Open the Philippines national view.
2. Select a month with real current and historical coverage.
3. Show clustered MODIS and VIIRS satellite detections.
4. Open the raw calendar and read the printed counts.
5. Toggle to harmonized; point out estimated patterns and the legend.
6. Show the factor, overlap years, correlation, and error panel.
7. Open the MODIS raw / MODIS scaled / VIIRS overlap chart.
8. Show current count, historical median, label, and baseline years.
9. Drill down to Bukidnon.
10. Ask the assistant: “Explain this month’s hotspot activity compared with
    previous years.”
11. Download hotspot CSV and analytics CSV.

**Speaker notes:**

“The national map answers where detections were observed recently. The
calendar answers how the selected period compares with history. The raw view
shows the sensor record; the harmonized view makes the cross-sensor method
explicit. The estimate pattern and error panel prevent a clean-looking chart
from hiding uncertainty. The AI only interprets the supplied summary.”

## Slide 4 — Team, limits, and next step (25 seconds)

**Title:** A transparent tool for better-informed monitoring

**On-slide content:**

- Member 1: FIRMS data, boundaries, aggregation, harmonization
- Member 2: Supabase, APIs, historical median, anomaly logic
- Member 3: map, filters, calendar, accessibility
- Member 4: AI interpretation, exports, presentation
- NASA FIRMS attribution and project URL: **VERIFY**

**What we do not claim:**

- A hotspot is not automatically a confirmed fire.
- A count anomaly is not a prediction of spread or danger.
- MODIS-converted values are estimates with measured error.
- The dashboard does not replace field verification or official emergency
  systems.

**Speaker notes:**

“FIRE MEMORY makes the historical comparison visible without overstating
what satellite detections can prove. Our next step is to continue validating
coverage and harmonization as the data record changes.”

## Submission checks

- [ ] Confirm the exact official challenge title.
- [ ] Insert one real, source-traceable number on Slide 1.
- [ ] Replace the attribution/project URL placeholder.
- [ ] Confirm all team members are registered for the same event/team.
- [ ] Complete every required project-submission field.
- [ ] Confirm the official deadline and local timezone.
- [ ] Test the deployed demo URL and backup video before submission.

The official 2026 site currently states that project submission opens on
November 14 at 9:00 AM and closes November 15 at 11:59 PM local time;
recheck the live submission page immediately before submitting.
