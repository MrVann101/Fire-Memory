import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  AI_MAX_OUTPUT_TOKENS,
  GEMINI_FALLBACK_MODELS,
  GEMINI_MODEL,
} from "../../src/lib/ai/config.ts";
import {
  buildDeterministicCdrrmoAdvisory,
  createAiBrief,
  getAiDisclaimer,
  validateBriefOutput,
} from "../../src/lib/ai/brief.ts";
import {
  LANGUAGE_OPTIONS,
  SUPPORTED_LANGUAGES,
  getMonthName,
  getTranslations,
} from "../../src/lib/i18n/translations.ts";
import { POST } from "../../src/app/api/ai/brief/route.ts";

const ROOT = process.cwd();

const bukidnonSummary = {
  region: { id: "PH-BUK", name: "Bukidnon", level: "province" },
  period: { year: 2025, month: 11 },
  metric: "harmonized",
  instrument: "ALL",
  currentCount: 12,
  currentIsEstimated: false,
  byInstrument: { MODIS: 7, VIIRS: 12 },
  baselineYears: [2010, 2011, 2012],
  estimatedBaselineYears: [2010, 2011],
  historicalMedian: 8,
  anomalyPercent: 50,
  label: "above_baseline",
  approximate: false,
  notes: ["Two baseline years are estimated."],
  dataCoverage: { firstDate: "2002-01-01", lastDate: "2025-11-30" },
  harmonization: {
    method: "median ratio of active cell-days",
    targetSensor: "VIIRS",
    overlapYears: [2012, 2013],
    factor: 1.7,
    factorScope: "national",
    correlation: 0.82,
    errorPercent: 18,
    estimatedYears: [2010, 2011],
    notes: [],
  },
  lastUpdated: "2026-11-14T00:00:00Z",
};

function readEnvLocalGeminiKey() {
  const envLocalPath = path.join(ROOT, ".env.local");
  const content = fs.readFileSync(envLocalPath, "utf8");
  const match = /^GEMINI_API_KEY=(.+)$/m.exec(content);
  return match?.[1]?.trim() ?? "";
}

test("GEMINI_API_KEY in .env.local is non-empty and model config uses gemini-2.5-flash with >=900 maxOutputTokens", () => {
  const apiKey = readEnvLocalGeminiKey();
  assert.ok(apiKey.length > 0, ".env.local must contain a non-empty GEMINI_API_KEY");
  assert.equal(GEMINI_MODEL, "gemini-2.5-flash");
  assert.notEqual(GEMINI_MODEL, "gemini-3.8-flash");
  assert.ok(
    AI_MAX_OUTPUT_TOKENS >= 900,
    `Expected AI_MAX_OUTPUT_TOKENS >= 900, got ${AI_MAX_OUTPUT_TOKENS}`,
  );
  assert.ok(GEMINI_FALLBACK_MODELS.includes("gemini-2.5-flash"));
});

test("POST /api/ai/brief with .env.local GEMINI_API_KEY returns HTTP 200 and grounded Bukidnon CDRRMO advisory", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = readEnvLocalGeminiKey();

  try {
    const response = await POST(
      new Request("http://localhost/api/ai/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          summary: bukidnonSummary,
          question:
            "Provide a direct CDRRMO situational advisory, priority places to closely monitor, and BFP/barangay verification guidance for this area and period.",
        }),
      }),
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(typeof body.answer, "string");
    assert.equal(typeof body.disclaimer, "string");
    assert.match(body.answer, /Computed values:/i);
    assert.match(body.answer, /Interpretation:/i);
    assert.match(body.answer, /Limitations:/i);
    assert.match(body.answer, /Bukidnon/i);
    assert.deepEqual(validateBriefOutput(body.answer, bukidnonSummary), {
      valid: true,
    });
  } finally {
    if (previousKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousKey;
    }
  }
});

test("buildDeterministicCdrrmoAdvisory passes validateBriefOutput across all 5 anomaly labels", () => {
  const labels = [
    "unusually_high",
    "above_baseline",
    "near_baseline",
    "below_baseline",
    "not_calculable",
  ];

  for (const label of labels) {
    const variant = {
      ...bukidnonSummary,
      label,
      ...(label === "not_calculable"
        ? { historicalMedian: null, anomalyPercent: null }
        : {}),
    };
    const advisory = buildDeterministicCdrrmoAdvisory(
      variant,
      "Provide a CDRRMO situational advisory.",
    );

    assert.match(advisory, /Computed values:/);
    assert.match(advisory, /Interpretation:/);
    assert.match(advisory, /Limitations:/);
    assert.deepEqual(
      validateBriefOutput(advisory, variant),
      { valid: true },
      `Expected valid advisory for label=${label}`,
    );
  }
});

test("MapView.tsx replaces verbose metadata paragraphs with compact Hotspot Intensity Scale legend", () => {
  const mapViewSource = fs.readFileSync(
    path.join(ROOT, "src/components/map/MapView.tsx"),
    "utf8",
  );
  const globalsCssSource = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8",
  );

  // Old verbose paragraphs must be completely removed
  assert.doesNotMatch(mapViewSource, /Cloud-free satellite land basemap/i);
  assert.doesNotMatch(
    mapViewSource,
    /Zoom to level 10 or closer to view sensor scan footprints/i,
  );
  assert.doesNotMatch(
    mapViewSource,
    /Orange-to-red province bubbles show relative hotspot volume/i,
  );

  // Compact Hotspot Intensity Scale legend must be present
  assert.match(mapViewSource, /map-legend-header/);
  assert.match(mapViewSource, /Hotspot Intensity Scale/);
  assert.match(mapViewSource, /map-intensity-scale/);
  assert.match(mapViewSource, /label:\s*"Low"/);
  assert.match(mapViewSource, /label:\s*"Moderate"/);
  assert.match(mapViewSource, /label:\s*"High"/);
  assert.match(mapViewSource, /label:\s*"Very High"/);

  // Matching CSS classes in globals.css
  assert.match(globalsCssSource, /\.map-legend-header/);
  assert.match(globalsCssSource, /\.map-intensity-scale/);
});

test("AssistantPanel.tsx implements tabbed Advisory (on-click button) and separate concise Watchlist with Bukidnon's 3 corridors", () => {
  const assistantPanelSource = fs.readFileSync(
    path.join(ROOT, "src/components/assistant/AssistantPanel.tsx"),
    "utf8",
  );
  const globalsCssSource = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8",
  );

  // Tabbed state ("advisory" | "watchlist"), .assistant-tabs, and on-click .assistant-generate-btn ("Get CDRRMO Advisory")
  assert.match(
    assistantPanelSource,
    /useState<"advisory"\s*\|\s*"watchlist">\s*\(\s*"advisory"\s*\)/,
  );
  assert.match(assistantPanelSource, /className="assistant-tabs"/);
  assert.match(assistantPanelSource, /assistant-generate-btn/);
  assert.match(assistantPanelSource, /Get CDRRMO Advisory/);
  assert.match(
    assistantPanelSource,
    /void requestAdvisory\(DEFAULT_AUTO_QUESTION,\s*summary\)/,
  );

  // Direct CDRRMO Posture Banner & KPI strip
  assert.match(assistantPanelSource, /className="assistant-panel"/);
  assert.match(assistantPanelSource, /assistant-direct-banner/);
  assert.match(assistantPanelSource, /assistant-kpi-strip/);

  // Separate Watchlist tab with Bukidnon's 3 operational corridors + map focus action
  assert.match(assistantPanelSource, /assistant-watchlist-section/);
  assert.match(assistantPanelSource, /assistant-watchlist-list/);
  assert.match(assistantPanelSource, /assistant-watchlist-item/);
  assert.match(assistantPanelSource, /Northern Bukidnon/);
  assert.match(assistantPanelSource, /Central Bukidnon/);
  assert.match(assistantPanelSource, /Southern & Western Bukidnon/);
  assert.match(assistantPanelSource, /Monitor Bukidnon/);
  assert.match(assistantPanelSource, /onSelectRegion/);

  // 3 organized AI brief cards for Computed values, Interpretation, and Limitations
  assert.match(assistantPanelSource, /assistant-brief-grid/);
  assert.match(assistantPanelSource, /assistant-brief-card/);
  assert.match(assistantPanelSource, /Computed values:/);
  assert.match(assistantPanelSource, /Interpretation:/);
  assert.match(assistantPanelSource, /Limitations:/);

  // Collapsible custom follow-up question drawer preserving #assistant-question and .assistant-submit
  assert.match(assistantPanelSource, /assistant-followup-details/);
  assert.match(assistantPanelSource, /id="assistant-question"/);
  assert.match(assistantPanelSource, /className="assistant-submit"/);

  // Matching CSS classes in globals.css
  assert.match(globalsCssSource, /\.assistant-tabs/);
  assert.match(globalsCssSource, /\.assistant-generate-btn/);
  assert.match(globalsCssSource, /\.assistant-direct-banner/);
  assert.match(globalsCssSource, /\.assistant-watchlist-section/);
  assert.match(globalsCssSource, /\.assistant-brief-grid/);
  assert.match(globalsCssSource, /\.assistant-followup-details/);
});

test("AnalyticsPanels.tsx and ExportButton.tsx implement clean KPI grids, collapsible technical details, and export pills/badges", () => {
  const analyticsPanelsSource = fs.readFileSync(
    path.join(ROOT, "src/components/charts/AnalyticsPanels.tsx"),
    "utf8",
  );
  const exportButtonSource = fs.readFileSync(
    path.join(ROOT, "src/components/export/ExportButton.tsx"),
    "utf8",
  );
  const globalsCssSource = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8",
  );

  // AnalyticsPanels.tsx checks
  assert.match(analyticsPanelsSource, /anomaly-kpi-grid/);
  assert.match(analyticsPanelsSource, /anomaly-comparison-meter/);
  assert.match(analyticsPanelsSource, /anomaly-technical-details/);

  // ExportButton.tsx checks
  assert.match(exportButtonSource, /export-scope-grid/);
  assert.match(exportButtonSource, /export-column-pills/);
  assert.match(exportButtonSource, /export-file-badge/);

  // Matching CSS classes in globals.css
  assert.match(globalsCssSource, /\.anomaly-kpi-grid/);
  assert.match(globalsCssSource, /\.anomaly-technical-details/);
  assert.match(globalsCssSource, /\.export-column-pills/);
  assert.match(globalsCssSource, /\.export-file-badge/);
});

test("DashboardShell passes hotspots, childCounts, regions, selectedRegion, and onSelectRegion to AssistantPanel", () => {
  const dashboardShellSource = fs.readFileSync(
    path.join(ROOT, "src/components/dashboard/DashboardShell.tsx"),
    "utf8",
  );

  const assistantPanelBlock =
    /<AssistantPanel[\s\S]*?\/>/.exec(dashboardShellSource)?.[0] ?? "";
  assert.ok(
    assistantPanelBlock.length > 0,
    "Expected <AssistantPanel /> invocation in DashboardShell.tsx",
  );
  assert.match(assistantPanelBlock, /summary=\{/);
  assert.match(assistantPanelBlock, /hotspots=\{/);
  assert.match(assistantPanelBlock, /childCounts=\{/);
  assert.match(assistantPanelBlock, /regions=\{/);
  assert.match(assistantPanelBlock, /selectedRegion=\{/);
  assert.match(assistantPanelBlock, /onSelectRegion=\{/);
});

test("AnalyticsPanels.tsx renders real same-month year-by-year bar graph, OverlapChart toggles & gridlines, and 4-metric HarmonizationPanel without verbose walls", () => {
  const analyticsPanelsSource = fs.readFileSync(
    path.join(ROOT, "src/components/charts/AnalyticsPanels.tsx"),
    "utf8",
  );

  // Year-by-Year Historical Comparison Bar Graph without fake synthetic jitter offsets
  assert.match(analyticsPanelsSource, /className="anomaly-history-chart"/);
  assert.match(analyticsPanelsSource, /className="anomaly-history-svg"/);
  assert.match(analyticsPanelsSource, /className="anomaly-chart-legend"/);
  assert.match(analyticsPanelsSource, /className="anomaly-median-line"/);
  assert.match(analyticsPanelsSource, /className="anomaly-bar-value"/);
  assert.match(analyticsPanelsSource, /bar\.count\.toLocaleString\("en-US"\)/);
  assert.match(analyticsPanelsSource, /function buildSameMonthHistoryBars[\s\S]*?calendar\?\.cells/);
  assert.doesNotMatch(analyticsPanelsSource, /Math\.(sin|cos|random)/);
  assert.doesNotMatch(analyticsPanelsSource, /jitter|synthetic/i);

  // Verbose text walls removed
  assert.doesNotMatch(analyticsPanelsSource, /Operational\s*&\s*Data\s*Limitations/i);
  assert.doesNotMatch(analyticsPanelsSource, /Calibration\s*Method\s*Notes/i);
  assert.doesNotMatch(analyticsPanelsSource, /className="analytics-notes"/);

  // OverlapChart view toggles, Y-axis gridlines, and bar value labels
  const overlapChartBlock =
    /export function OverlapChart[\s\S]*$/.exec(analyticsPanelsSource)?.[0] ?? "";
  assert.ok(
    overlapChartBlock.length > 0,
    "Expected OverlapChart component in AnalyticsPanels.tsx",
  );
  assert.match(overlapChartBlock, /useState<"annual"\s*\|\s*"monthly">\("annual"\)/);
  assert.match(overlapChartBlock, /className="overlap-view-toggle"/);
  assert.match(overlapChartBlock, /Yearly Totals/);
  assert.match(overlapChartBlock, /Recent 12 Months/);
  assert.match(overlapChartBlock, /className="chart-grid-line"/);
  assert.match(overlapChartBlock, /className="chart-axis-label"/);
  assert.match(overlapChartBlock, /className="chart-bar-value"/);

  // HarmonizationPanel trimmed to 4 core calibration metrics
  const harmonizationPanelBlock =
    /export function HarmonizationPanel[\s\S]*?\n\}\n/.exec(
      analyticsPanelsSource,
    )?.[0] ?? "";
  assert.ok(
    harmonizationPanelBlock.length > 0,
    "Expected HarmonizationPanel component in AnalyticsPanels.tsx",
  );
  const dtMatches = harmonizationPanelBlock.match(/<dt>[\s\S]*?<\/dt>/g) ?? [];
  assert.equal(
    dtMatches.length,
    4,
    `Expected HarmonizationPanel to contain exactly 4 core calibration metrics, got ${dtMatches.length}`,
  );
  assert.match(harmonizationPanelBlock, /MODIS-to-VIIRS Scaling Factor/);
  assert.match(harmonizationPanelBlock, /Overlap Calibration Years/);
  assert.match(harmonizationPanelBlock, /Calibration Agreement \(r\)/);
  assert.match(harmonizationPanelBlock, /Calibration Error \(MAPE\)/);
});

test("DashboardShell.tsx passes calendar and liveCounts to AnomalyPanel, renders OverlapChart right after AnomalyPanel, and renders compact footer on non-map pages", () => {
  const dashboardShellSource = fs.readFileSync(
    path.join(ROOT, "src/components/dashboard/DashboardShell.tsx"),
    "utf8",
  );

  const anomalyPanelBlock =
    /<AnomalyPanel[\s\S]*?\/>/.exec(dashboardShellSource)?.[0] ?? "";
  assert.ok(
    anomalyPanelBlock.length > 0,
    "Expected <AnomalyPanel /> invocation in DashboardShell.tsx",
  );
  assert.match(anomalyPanelBlock, /calendar=\{/);
  assert.match(anomalyPanelBlock, /liveCounts=\{/);

  assert.match(
    dashboardShellSource,
    /<AnomalyPanel[\s\S]*?\/>\s*<OverlapChart[\s\S]*?\/>\s*<HarmonizationPanel/,
  );

  const nonMapSection =
    /resolvedFeature !== "map"[\s\S]*?resolvedFeature === "map"/.exec(
      dashboardShellSource,
    )?.[0] ?? "";
  assert.ok(
    nonMapSection.length > 0,
    "Expected non-map feature branch in DashboardShell.tsx",
  );
  assert.match(
    nonMapSection,
    /<footer className="page-footer page-footer-compact">/,
  );
});

test("ExportButton.tsx includes preview metrics, format badge, scope grid, column pills, and output file badge", () => {
  const exportButtonSource = fs.readFileSync(
    path.join(ROOT, "src/components/export/ExportButton.tsx"),
    "utf8",
  );

  assert.match(exportButtonSource, /className="export-preview-metrics"/);
  assert.match(exportButtonSource, /className="export-option-format"/);
  assert.match(exportButtonSource, /className="export-scope-grid"/);
  assert.match(exportButtonSource, /className="export-column-pills"/);
  assert.match(exportButtonSource, /className="export-file-badge"/);
});

test("globals.css sets overlap-chart min-height 210px and defines upgraded anomaly, overlap, export, and compact footer styles", () => {
  const globalsCssSource = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8",
  );

  assert.match(
    globalsCssSource,
    /\.overlap-chart\s*\{[^}]*min-height:\s*210px;/,
  );
  assert.match(globalsCssSource, /\.anomaly-history-chart\s*\{/);
  assert.match(globalsCssSource, /\.anomaly-history-svg\s*\{/);
  assert.match(globalsCssSource, /\.anomaly-chart-median-badge\s*\{/);
  assert.match(globalsCssSource, /\.anomaly-chart-legend\s*\{/);
  assert.match(globalsCssSource, /\.overlap-view-toggle\s*\{/);
  assert.match(globalsCssSource, /\.export-preview-metrics\s*\{/);
  assert.match(globalsCssSource, /\.page-footer-compact\s*\{/);
});

test("harmonization.ts includes regional child-province overlap fallback", () => {
  const harmonizationSource = fs.readFileSync(
    path.join(ROOT, "src/lib/analytics/harmonization.ts"),
    "utf8",
  );

  assert.match(
    harmonizationSource,
    /rows\.length === 0 && resolved\?\.region\.level === "region"/,
  );
  assert.match(
    harmonizationSource,
    /\.from\("regions"\)[\s\S]*?\.eq\("parent_id", resolved\.dbId\)[\s\S]*?\.eq\("level", "province"\)/,
  );
  assert.match(
    harmonizationSource,
    /\.from\("monthly_counts"\)[\s\S]*?\.in\("region_id", childIds\)/,
  );
});

test("Watchlist items stay strictly contained inside .assistant-panel without horizontal overflow", () => {
  const assistantPanelSource = fs.readFileSync(
    path.join(ROOT, "src/components/assistant/AssistantPanel.tsx"),
    "utf8",
  );
  const globalsCssSource = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8",
  );

  // Two-row card layout instead of inline nowrap overflow
  assert.match(assistantPanelSource, /className="assistant-watchlist-item-top"/);
  assert.match(assistantPanelSource, /className="assistant-watchlist-metrics"/);
  assert.doesNotMatch(assistantPanelSource, /whiteSpace:\s*"nowrap"/);

  // Containment & zero horizontal blowout inside globals.css
  assert.match(
    globalsCssSource,
    /\.map-assistant-dock\s*\{[^}]*overflow-x:\s*hidden;/,
  );
  assert.match(
    globalsCssSource,
    /\.assistant-panel\s*\{[^}]*overflow-x:\s*hidden;/,
  );
  assert.match(
    globalsCssSource,
    /\.assistant-watchlist-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  );
  assert.match(
    globalsCssSource,
    /\.assistant-watchlist-item\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/,
  );
});

test("MODIS and VIIRS live counts merge cleanly into AI advisory payloads and generate sensor-specific CDRRMO guidance", async () => {
  const { countLiveCellDays, mergeLiveCountsIntoSummary } = await import(
    "../../src/lib/analytics/liveCounts.ts"
  );
  const { AI_SYSTEM_INSTRUCTION } = await import("../../src/lib/ai/prompt.ts");
  const { aiBriefRequestSchema } = await import("../../src/lib/ai/request.ts");
  const { createAiBrief } = await import("../../src/lib/ai/brief.ts");

  const sampleHotspots = [
    {
      id: "h1",
      latitude: 7.91,
      longitude: 125.09,
      acquisitionDatetime: "2026-11-15T05:00:00Z",
      instrument: "VIIRS",
      confidence: "high",
      brightness: 340,
      frp: 18,
    },
    {
      id: "h2",
      latitude: 7.915,
      longitude: 125.094,
      acquisitionDatetime: "2026-11-15T06:00:00Z",
      instrument: "VIIRS",
      confidence: "nominal",
      brightness: 332,
      frp: 11,
    },
    {
      id: "h3",
      latitude: 8.15,
      longitude: 125.12,
      acquisitionDatetime: "2026-11-15T07:00:00Z",
      instrument: "VIIRS",
      confidence: "nominal",
      brightness: 335,
      frp: 12,
    },
    {
      id: "h4",
      latitude: 7.85,
      longitude: 125.05,
      acquisitionDatetime: "2026-11-15T08:00:00Z",
      instrument: "MODIS",
      confidence: "nominal",
      brightness: 320,
      frp: 9,
    },
  ];

  const viirsLive = countLiveCellDays(sampleHotspots, "VIIRS");
  const modisLive = countLiveCellDays(sampleHotspots, "MODIS");
  assert.equal(viirsLive, 2);
  assert.equal(modisLive, 1);

  const nullCurrentSummary = {
    ...bukidnonSummary,
    period: { year: 2026, month: 11 },
    currentCount: null,
    byInstrument: { MODIS: null, VIIRS: null },
    historicalMedian: 13,
    anomalyPercent: null,
    label: "not_calculable",
  };

  const merged = mergeLiveCountsIntoSummary(
    nullCurrentSummary,
    { viirs: viirsLive, modis: modisLive, harmonized: viirsLive },
    sampleHotspots,
  );
  assert.equal(merged.currentCount, 2);
  assert.deepEqual(merged.byInstrument, { MODIS: 1, VIIRS: 2 });
  assert.ok(aiBriefRequestSchema.safeParse({ summary: merged, question: "Explain." }).success);

  // Archive non-null values stay intact when liveCounts is null
  const archiveUntouched = mergeLiveCountsIntoSummary(bukidnonSummary, null, []);
  assert.deepEqual(archiveUntouched, bukidnonSummary);

  // Deterministic CDRRMO advice covers both active sensors, single-sensor, and explicit 0/0 cases
  const bothSensorsAdvice = buildDeterministicCdrrmoAdvisory(merged);
  assert.match(bothSensorsAdvice, /2 VIIRS/);
  assert.match(bothSensorsAdvice, /1 MODIS/);
  assert.match(bothSensorsAdvice, /BFP and Barangay DRRMC/i);
  assert.deepEqual(validateBriefOutput(bothSensorsAdvice, merged), { valid: true });

  const zeroSensorsSummary = {
    ...bukidnonSummary,
    currentCount: 0,
    byInstrument: { MODIS: 0, VIIRS: 0 },
  };
  const zeroAdvice = buildDeterministicCdrrmoAdvisory(zeroSensorsSummary);
  assert.match(zeroAdvice, /0 VIIRS/);
  assert.match(zeroAdvice, /0 MODIS/);
  assert.deepEqual(validateBriefOutput(zeroAdvice, zeroSensorsSummary), { valid: true });

  const modisOnlySummary = {
    ...bukidnonSummary,
    currentCount: 4,
    byInstrument: { MODIS: 4, VIIRS: 0 },
  };
  const modisOnlyAdvice = buildDeterministicCdrrmoAdvisory(modisOnlySummary);
  assert.match(modisOnlyAdvice, /4 MODIS/);
  assert.match(modisOnlyAdvice, /0 VIIRS/);
  assert.deepEqual(validateBriefOutput(modisOnlyAdvice, modisOnlySummary), { valid: true });

  // Gemini prompt instructs sensor-grounded advice
  assert.match(AI_SYSTEM_INSTRUCTION, /byInstrument\.VIIRS/i);
  assert.match(AI_SYSTEM_INSTRUCTION, /byInstrument\.MODIS/i);

  // DashboardShell & AssistantPanel wire live MODIS/VIIRS counts into /api/ai/brief requests
  const dashboardSource = fs.readFileSync(
    path.join(ROOT, "src/components/dashboard/DashboardShell.tsx"),
    "utf8",
  );
  const assistantSource = fs.readFileSync(
    path.join(ROOT, "src/components/assistant/AssistantPanel.tsx"),
    "utf8",
  );
  assert.match(dashboardSource, /liveCounts=\{liveCounts\}/);
  assert.match(assistantSource, /mergeLiveCountsIntoSummary/);
  assert.match(assistantSource, /summary:\s*payloadSummary/);

  // createAiBrief accepts sensor-rich summary and returns grounded response
  const briefResult = await createAiBrief(
    { summary: merged, question: "Provide CDRRMO advisory for MODIS and VIIRS." },
    async () => bothSensorsAdvice,
  );
  assert.match(briefResult.answer, /VIIRS/);
  assert.match(briefResult.answer, /MODIS/);
});

test("CDRRMO Advisory button returns cleanly to the right side without blocking summary cards or Zoom +/- controls", () => {
  const globalsCssSource = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8",
  );

  // Desktop right-side positioning clear of top summary cards and left Zoom +/- buttons
  assert.match(
    globalsCssSource,
    /\.map-assistant-trigger\s*\{[^}]*position:\s*absolute;[^}]*top:\s*162px;[^}]*right:\s*16px;[^}]*left:\s*auto;/,
  );
  assert.match(
    globalsCssSource,
    /\.map-assistant-dock\s*\{[^}]*position:\s*absolute;[^}]*top:\s*214px;[^}]*right:\s*16px;[^}]*left:\s*auto;[^}]*width:\s*min\(460px,\s*calc\(100% - 104px\)\);/,
  );
  assert.match(
    globalsCssSource,
    /@media\s*\(max-width:\s*1080px\)[\s\S]*?\.map-assistant-trigger\s*\{[^}]*top:\s*158px;[^}]*right:\s*12px;[^}]*left:\s*auto;/,
  );
  assert.match(
    globalsCssSource,
    /@media\s*\(max-width:\s*600px\)[\s\S]*?\.map-assistant-trigger\s*\{[^}]*top:\s*152px;[^}]*right:\s*10px;[^}]*left:\s*auto;[\s\S]*?\.map-assistant-dock\s*\{[^}]*top:\s*284px;[^}]*right:\s*10px;[^}]*left:\s*10px;/,
  );
});

test("Ask a specific question adapts deterministic and prompt responses to user intent and exposes inline Q&A feedback", () => {
  const assistantSource = fs.readFileSync(
    path.join(ROOT, "src/components/assistant/AssistantPanel.tsx"),
    "utf8",
  );
  const globalsCssSource = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8",
  );

  const sensorAnswer = buildDeterministicCdrrmoAdvisory(
    bukidnonSummary,
    "How should our CDRRMO interpret the VIIRS and MODIS detections for this period?",
  );
  const baselineAnswer = buildDeterministicCdrrmoAdvisory(
    bukidnonSummary,
    "Why is this month's hotspot count vs. historical median above normal?",
  );
  const limitationsAnswer = buildDeterministicCdrrmoAdvisory(
    { ...bukidnonSummary, currentIsEstimated: true },
    "What data limitations should we note in our LGU situational briefing?",
  );
  const watchlistAnswer = buildDeterministicCdrrmoAdvisory(
    bukidnonSummary,
    "Where are the places to monitor in Bukidnon for BFP verification?",
  );

  assert.notEqual(sensorAnswer, baselineAnswer);
  assert.notEqual(limitationsAnswer, watchlistAnswer);
  assert.match(sensorAnswer, /VIIRS recorded 12.*MODIS recorded 7/i);
  assert.match(baselineAnswer, /12 detections vs\. a 3-year historical median of 8/i);
  assert.match(limitationsAnswer, /Key briefing caveats for Bukidnon/i);
  assert.match(watchlistAnswer, /Watchlist tab/i);

  assert.deepEqual(validateBriefOutput(sensorAnswer, bukidnonSummary), { valid: true });
  assert.deepEqual(validateBriefOutput(baselineAnswer, bukidnonSummary), { valid: true });
  assert.deepEqual(
    validateBriefOutput(limitationsAnswer, { ...bukidnonSummary, currentIsEstimated: true }),
    { valid: true },
  );
  assert.deepEqual(validateBriefOutput(watchlistAnswer, bukidnonSummary), { valid: true });

  // UI echoes asked question, provides inline empty hint, Enter submit, and auto-scrolls answer into view
  assert.match(assistantSource, /lastAskedQuestion/);
  assert.match(assistantSource, /questionHint/);
  assert.match(assistantSource, /handleQuestionKeyDown/);
  assert.match(assistantSource, /scrollAnswerIntoView/);
  assert.match(assistantSource, /className="assistant-question-echo"/);
  assert.match(globalsCssSource, /\.assistant-question-echo\s*\{/);
  assert.match(globalsCssSource, /\.assistant-question-hint\s*\{/);
});

test("Map view omits verbose bottom status banner and historical footer notes on normal loads", () => {
  const dashboardSource = fs.readFileSync(
    path.join(ROOT, "src/components/dashboard/DashboardShell.tsx"),
    "utf8",
  );

  assert.doesNotMatch(dashboardSource, /Dashboard data loaded/);
  assert.doesNotMatch(dashboardSource, /FIRE MEMORY · Historical satellite detections/);
  assert.doesNotMatch(dashboardSource, /DATA_ATTRIBUTION/);
  assert.doesNotMatch(dashboardSource, /DATA_LIMITATIONS/);
  assert.doesNotMatch(dashboardSource, /HARMONIZATION_NOTE/);
  assert.match(dashboardSource, /resolvedFeature === "map" && dataErrors\.length > 0/);
});

test("Map overlay cards use 60% frosted background transparency", () => {
  const globalsCssSource = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8",
  );

  assert.match(
    globalsCssSource,
    /\.map-summary-card\s*\{[^}]*background:\s*rgb\(11 19 43 \/ 60%\);/,
  );
  assert.match(
    globalsCssSource,
    /\.map-workspace\s+\.map-metadata\s*\{[^}]*background:\s*rgb\(11 19 43 \/ 60%\);/,
  );

  const dashboardSource = fs.readFileSync(
    path.join(ROOT, "src/components/dashboard/DashboardShell.tsx"),
    "utf8",
  );
  assert.doesNotMatch(dashboardSource, /<span>CDRRMO Advisory AI<\/span>/);
  assert.match(dashboardSource, /<span>Advisory AI<\/span>/);
});

test("Sidebar brand renders the FireMemory SVG logo instead of the FM badge", () => {
  const logoSvgSource = fs.readFileSync(
    path.join(ROOT, "public/fire-memory-logo.svg"),
    "utf8",
  );
  assert.match(logoSvgSource, /viewBox="0 0 256 256"/);
  assert.match(logoSvgSource, /id="iconFireGrad"/);
  assert.match(logoSvgSource, /id="iconCircuitGrad"/);
  assert.match(logoSvgSource, /rx="56"/);

  const logoComponentSource = fs.readFileSync(
    path.join(ROOT, "src/components/brand/FireMemoryLogo.tsx"),
    "utf8",
  );
  assert.match(logoComponentSource, /export function FireMemoryLogo/);
  assert.match(logoComponentSource, /id="iconFireGrad"/);
  assert.match(logoComponentSource, /id="iconCircuitGrad"/);

  const dashboardSource = fs.readFileSync(
    path.join(ROOT, "src/components/dashboard/DashboardShell.tsx"),
    "utf8",
  );
  assert.match(
    dashboardSource,
    /import\s+\{\s*FireMemoryLogo\s*\}\s+from\s+"@\/components\/brand\/FireMemoryLogo"/,
  );
  assert.match(
    dashboardSource,
    /<span className="sidebar-brand-mark" aria-hidden="true">\s*<FireMemoryLogo \/>\s*<\/span>/,
  );
  assert.doesNotMatch(
    dashboardSource,
    /<span className="sidebar-brand-mark" aria-hidden="true">\s*FM\s*<\/span>/,
  );

  const globalsCssSource = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8",
  );
  assert.match(
    globalsCssSource,
    /\.sidebar-brand-mark\s*\{[^}]*background:\s*transparent;/,
  );
});

test("buildDeterministicCdrrmoAdvisory passes validateBriefOutput in en, ceb, and fil across all 5 anomaly labels and question intents", () => {
  const labels = [
    "below_baseline",
    "near_baseline",
    "above_baseline",
    "unusually_high",
    "not_calculable",
  ];

  const questionsByLanguage = {
    en: [
      "",
      "Why do small-area (VIIRS) and wide-area (MODIS) sensor detections differ?",
      "Which area needs immediate CDRRMO verification?",
    ],
    ceb: [
      "",
      "Nganong magkalahi ang ihap sa VIIRS ug MODIS?",
      "Asang dapita ang unahon pagsusi sa CDRRMO?",
    ],
    fil: [
      "",
      "Bakit magkaiba ang bilang ng VIIRS at MODIS?",
      "Aling lugar ang dapat unahing beripikahin ng CDRRMO?",
    ],
  };

  for (const label of labels) {
    const payload = {
      ...bukidnonSummary,
      label,
      historicalMedian: label === "not_calculable" ? null : bukidnonSummary.historicalMedian,
      anomalyPercent: label === "not_calculable" ? null : bukidnonSummary.anomalyPercent,
      baselineYears: label === "not_calculable" ? [] : bukidnonSummary.baselineYears,
      approximate: label === "not_calculable",
    };

    const sampleIndex = 0;
    const enAnswer = buildDeterministicCdrrmoAdvisory(
      payload,
      questionsByLanguage.en[sampleIndex],
      "en"
    );
    const cebAnswer = buildDeterministicCdrrmoAdvisory(
      payload,
      questionsByLanguage.ceb[sampleIndex],
      "ceb"
    );
    const filAnswer = buildDeterministicCdrrmoAdvisory(
      payload,
      questionsByLanguage.fil[sampleIndex],
      "fil"
    );

    assert.notEqual(cebAnswer, enAnswer);
    assert.notEqual(filAnswer, enAnswer);
    assert.notEqual(cebAnswer, filAnswer);

    for (const language of SUPPORTED_LANGUAGES) {
      for (const question of questionsByLanguage[language]) {
        const answer = buildDeterministicCdrrmoAdvisory(payload, question, language);
        const verdict = validateBriefOutput(answer, payload);
        assert.equal(
          verdict.valid,
          true,
          `Expected valid deterministic brief for language=${language}, label=${label}, question=${question}: ${verdict.reason ?? ""}`
        );
        assert.match(answer, /Computed values:/);
        assert.match(answer, /Interpretation:/);
        assert.match(answer, /Limitations:/);
      }
    }
  }
});

test("createAiBrief refuses unsafe Cebuano and Filipino questions without calling Gemini and forwards safe language requests", async () => {
  const unsafeCases = [
    { language: "ceb", question: "Mobakwit na ba ta karon?" },
    { language: "ceb", question: "Mokatap ba ang kalayo ugma?" },
    { language: "fil", question: "Dapat na ba lumikas ngayon?" },
    { language: "fil", question: "Kakalat ba ang sunog dito?" },
  ];

  for (const unsafeCase of unsafeCases) {
    const result = await createAiBrief(
      {
        summary: bukidnonSummary,
        question: unsafeCase.question,
        language: unsafeCase.language,
      },
      async () => {
        throw new Error("Generator should not be called for unsafe questions");
      }
    );
    assert.equal(result.disclaimer, getAiDisclaimer(unsafeCase.language));
    assert.match(result.answer, /Computed values:/);
    assert.match(result.answer, /Interpretation:/);
    assert.match(result.answer, /Limitations:/);
  }

  let capturedLanguage = null;
  const mockCebuanoReply =
    "Computed values: Sa Bukidnon, ang gidaghanon sa aktibong cell-days kay 12 (VIIRS 12, MODIS 7) batok sa median nga 8.\n\nInterpretation: Mas taas kini kay sa kasagaran sa buwan, busa makig-coordinate sa BFP ug Barangay DRRMC para sa ground verification.\n\nLimitations: Mga deteksyon sa init gikan sa satelayt lang kini ug dili kompirmadong sunog.";

  const response = await createAiBrief(
    {
      summary: bukidnonSummary,
      question: "Unsay kahimtang sa mga hotspot karon?",
      language: "ceb",
    },
    async (request) => {
      capturedLanguage = request.language;
      return mockCebuanoReply;
    }
  );

  assert.equal(capturedLanguage, "ceb");
  assert.equal(response.answer, mockCebuanoReply);
  assert.equal(response.disclaimer, getAiDisclaimer("ceb"));
  assert.notEqual(getAiDisclaimer("ceb"), getAiDisclaimer("en"));
  assert.notEqual(getAiDisclaimer("fil"), getAiDisclaimer("en"));
});

test("translations dictionary and whole-app multilingual switchers cover en, ceb, and fil cleanly", () => {
  assert.deepEqual([...SUPPORTED_LANGUAGES], ["en", "ceb", "fil"]);
  assert.equal(LANGUAGE_OPTIONS.length, 3);
  assert.equal(getMonthName(1, "ceb"), "Enero");
  assert.equal(getMonthName(11, "en"), "November");

  const en = getTranslations("en");
  const ceb = getTranslations("ceb");
  const fil = getTranslations("fil");

  assert.notEqual(ceb.nav.map, en.nav.map);
  assert.notEqual(fil.nav.anomaly, en.nav.anomaly);
  assert.notEqual(ceb.ai.title, en.ai.title);
  assert.notEqual(fil.calendar.title, en.calendar.title);
  assert.notEqual(ceb.analytics.anomalyTitle, en.analytics.anomalyTitle);
  assert.notEqual(fil.exportPanel.title, en.exportPanel.title);
  assert.notEqual(ceb.shell.mapCards.comparisonLabel, en.shell.mapCards.comparisonLabel);

  for (const lang of SUPPORTED_LANGUAGES) {
    const dict = getTranslations(lang);
    assert.ok(dict.nav.map.length > 0);
    assert.ok(dict.shell.mapCards.smallAreaSensor.length > 0);
    assert.ok(dict.calendar.title.length > 0);
    assert.ok(dict.analytics.anomalyTitle.length > 0);
    assert.ok(dict.exportPanel.downloadHotspots.length > 0);
    assert.ok(dict.ai.suggestedQuestions.length >= 3);
  }

  const providerSource = fs.readFileSync(
    path.join(ROOT, "src/components/dashboard/DashboardFiltersProvider.tsx"),
    "utf8"
  );
  const shellSource = fs.readFileSync(
    path.join(ROOT, "src/components/dashboard/DashboardShell.tsx"),
    "utf8"
  );
  const assistantSource = fs.readFileSync(
    path.join(ROOT, "src/components/assistant/AssistantPanel.tsx"),
    "utf8"
  );
  const mapSource = fs.readFileSync(
    path.join(ROOT, "src/components/map/MapView.tsx"),
    "utf8"
  );
  const leafletSource = fs.readFileSync(
    path.join(ROOT, "src/components/map/LeafletCanvas.tsx"),
    "utf8"
  );
  const calendarSource = fs.readFileSync(
    path.join(ROOT, "src/components/calendar/ActivityCalendar.tsx"),
    "utf8"
  );
  const analyticsSource = fs.readFileSync(
    path.join(ROOT, "src/components/charts/AnalyticsPanels.tsx"),
    "utf8"
  );
  const exportSource = fs.readFileSync(
    path.join(ROOT, "src/components/export/ExportButton.tsx"),
    "utf8"
  );
  const cssSource = fs.readFileSync(
    path.join(ROOT, "src/app/globals.css"),
    "utf8"
  );

  assert.match(providerSource, /fire-memory-language/);
  assert.match(providerSource, /document\.documentElement\.lang = language/);
  assert.match(shellSource, /sidebar-lang-panel/);
  assert.match(shellSource, /id="calendar-language"/);
  assert.match(shellSource, /id="feature-language"/);
  assert.match(assistantSource, /assistant-lang-switcher/);
  assert.match(assistantSource, /language,/);
  assert.match(mapSource, /getTranslations\(language\)/);
  assert.match(leafletSource, /getTranslations\(language\)/);
  assert.match(calendarSource, /getTranslations\(language\)/);
  assert.match(analyticsSource, /getTranslations\(language\)/);
  assert.match(exportSource, /getTranslations\(language\)/);
  assert.match(cssSource, /\.sidebar-lang-panel/);
  assert.match(cssSource, /\.assistant-lang-switcher/);
});
