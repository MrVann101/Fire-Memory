"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AnomalyLabel, ChildCount, Hotspot, Region } from "@/contracts/types";
import { AI_MAX_QUESTION_LENGTH } from "@/lib/ai/config";
import type { AnalyticsSummaryForAi } from "@/lib/ai/request";
import {
  mergeLiveCountsIntoSummary,
  type LiveCountsSnapshot,
} from "@/lib/analytics/liveCounts";

interface AiBriefResponse {
  answer: string;
  disclaimer: string;
}

interface AiErrorResponse {
  message?: string;
}

export interface AssistantPanelProps {
  summary: AnalyticsSummaryForAi | null;
  liveCounts?: LiveCountsSnapshot | null;
  hotspots?: Hotspot[];
  childCounts?: ChildCount[];
  regions?: Region[];
  selectedRegion?: Region | null;
  onSelectRegion?: (regionId: string) => void;
  onClose?: () => void;
}

interface WatchlistItem {
  id: string;
  title: string;
  subtitle: string;
  badgeText: "HIGH" | "MODERATE" | "WATCH";
  badgeColor: string;
  badgeTone: "critical" | "elevated" | "active" | "standing";
  count: number;
  countLabel: string;
  targetRegionId?: string;
  actionLabel?: string;
  isPinnedBukidnon?: boolean;
}

interface ParsedAdvisorySections {
  computedValues: string;
  interpretation: string;
  limitations: string;
}

const DEFAULT_AUTO_QUESTION =
  "Provide a direct CDRRMO situational advisory using real MODIS and VIIRS detection counts, priority places to closely monitor, and BFP/barangay verification guidance for this area and period.";

const SUGGESTED_QUESTIONS = [
  "What does this month's hotspot count vs. historical median mean for CDRRMO monitoring?",
  "How should our CDRRMO interpret the VIIRS and MODIS detections for this period?",
  "What data limitations should we note in our LGU situational briefing?",
];

const DEFAULT_DISCLAIMER =
  "CDRRMO Advisory AI interpretation only. Satellite detections are not confirmed fires, forecasts, or emergency instructions.";

function formatAdvisoryAnswer(text: string) {
  const parts = text.split(/(Computed values:|Interpretation:|Limitations:)/gi);
  return parts.map((part, index) => {
    if (/^(Computed values:|Interpretation:|Limitations:)$/i.test(part)) {
      return (
        <strong key={index} className="assistant-section-heading">
          {part}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function cleanAdvisorySection(value: string): string {
  return value
    .replace(/\s*\((?:province|country|region|custom)\s+level\)/gi, "")
    .replace(/\s*\(month\s+\d+\)/gi, "")
    .replace(/\s*\((?:ALL|VIIRS|MODIS)\s+view\)/gi, "")
    .replace(/\s*MODIS-to-VIIRS harmonization uses[^.]*\./gi, "")
    .replace(/\s*Available archive coverage runs[^.]*\./gi, "")
    .replace(/\s*Summary notes:[\s\S]*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseStructuredAdvisory(text: string): ParsedAdvisorySections | null {
  const computedMatch =
    /Computed values:\s*([\s\S]*?)(?=Interpretation:|Limitations:|$)/i.exec(text);
  const interpretationMatch =
    /Interpretation:\s*([\s\S]*?)(?=Limitations:|$)/i.exec(text);
  const limitationsMatch = /Limitations:\s*([\s\S]*?)$/i.exec(text);

  if (!computedMatch && !interpretationMatch && !limitationsMatch) {
    return null;
  }

  return {
    computedValues:
      cleanAdvisorySection(computedMatch?.[1] ?? "") ||
      "See summary metrics above.",
    interpretation:
      cleanAdvisorySection(interpretationMatch?.[1] ?? "") ||
      "Maintain standard CDRRMO monitoring posture.",
    limitations:
      cleanAdvisorySection(limitationsMatch?.[1] ?? "") ||
      "Satellite hotspots indicate heat sources, not confirmed fires—verify with BFP or barangay responders.",
  };
}

function isAiBriefResponse(value: unknown): value is AiBriefResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.answer === "string" &&
    typeof response.disclaimer === "string"
  );
}

function getErrorMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const message = (value as AiErrorResponse).message;
  return typeof message === "string" && message.length > 0 ? message : null;
}

function getDirectPosture(summary: AnalyticsSummaryForAi | null) {
  const label: AnomalyLabel = summary?.label ?? "not_calculable";

  switch (label) {
    case "unusually_high":
      return {
        tone: "unusually_high" as const,
        badge: "CRITICAL WATCH",
      };
    case "above_baseline":
      return {
        tone: "above_baseline" as const,
        badge: "ABOVE NORMAL",
      };
    case "near_baseline":
      return {
        tone: "near_baseline" as const,
        badge: "NEAR NORMAL",
      };
    case "below_baseline":
      return {
        tone: "below_baseline" as const,
        badge: "BELOW NORMAL",
      };
    default:
      return {
        tone: "not_calculable" as const,
        badge: "ACTIVE WATCH",
      };
  }
}

function getPriorityStyle(
  count: number,
  anomalyLabel?: AnomalyLabel
): {
  badgeText: "HIGH" | "MODERATE" | "WATCH";
  badgeColor: string;
  badgeTone: WatchlistItem["badgeTone"];
} {
  if (count >= 5 || (count > 0 && anomalyLabel === "unusually_high")) {
    return {
      badgeText: "HIGH",
      badgeColor: "var(--hotspot-very-high, #ef4444)",
      badgeTone: "critical",
    };
  }
  if (count >= 2) {
    return {
      badgeText: "MODERATE",
      badgeColor: "var(--hotspot-high, #ea580c)",
      badgeTone: "elevated",
    };
  }
  if (count === 1) {
    return {
      badgeText: "MODERATE",
      badgeColor: "var(--hotspot-moderate, #f97316)",
      badgeTone: "active",
    };
  }
  return {
    badgeText: "WATCH",
    badgeColor: "var(--hotspot-low, #fb923c)",
    badgeTone: "standing",
  };
}

function buildPriorityWatchlist(
  summary: AnalyticsSummaryForAi | null,
  hotspots: Hotspot[],
  childCounts: ChildCount[],
  regions: Region[],
  selectedRegion?: Region | null
): {
  scopeBadge: string;
  items: WatchlistItem[];
  showQuickBukidnonJump: boolean;
} {
  const regionId = summary?.region.id ?? selectedRegion?.id ?? "PH";
  const regionName =
    summary?.region.name ?? selectedRegion?.name ?? "The Philippines";
  const regionLevel =
    summary?.region.level ?? selectedRegion?.level ?? "country";
  const isBukidnon =
    regionId === "PH-BUK" || regionName.toLowerCase().includes("bukidnon");

  // CASE 1: BUKIDNON PROVINCIAL CORRIDOR WATCHLIST
  if (isBukidnon) {
    const corridors = [
      {
        id: "buk-north",
        title: "Northern Bukidnon",
        subtitle: "Malaybalay · Impasugong · Manolo Fortich · Sumilao",
        count: hotspots.filter((h) => h.latitude >= 8.05).length,
      },
      {
        id: "buk-central",
        title: "Central Bukidnon",
        subtitle: "Valencia · Maramag · Lantapan · Quezon",
        count: hotspots.filter((h) => h.latitude >= 7.75 && h.latitude < 8.05)
          .length,
      },
      {
        id: "buk-south",
        title: "Southern & Western Bukidnon",
        subtitle: "Don Carlos · Pangantucan · Talakag · Kitaotao",
        count: hotspots.filter((h) => h.latitude < 7.75).length,
      },
    ];

    const items: WatchlistItem[] = corridors
      .map((corridor) => {
        const priority = getPriorityStyle(corridor.count, summary?.label);
        return {
          id: corridor.id,
          title: corridor.title,
          subtitle: corridor.subtitle,
          badgeText: priority.badgeText,
          badgeColor: priority.badgeColor,
          badgeTone: priority.badgeTone,
          count: corridor.count,
          countLabel: `${corridor.count.toLocaleString("en-US")} hotspot${
            corridor.count === 1 ? "" : "s"
          }`,
          isPinnedBukidnon: true,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      scopeBadge: "Bukidnon Sectors",
      items,
      showQuickBukidnonJump: false,
    };
  }

  // CASE 2: NATIONAL (THE PHILIPPINES) WATCHLIST WITH PINNED BUKIDNON + TOP PROVINCES
  if (regionLevel === "country" || regionId === "PH") {
    const bukidnonRegion = regions.find(
      (r) => r.id === "PH-BUK" || r.name.toLowerCase().includes("bukidnon")
    );
    const bukidnonBbox = bukidnonRegion?.bbox ?? [124.45, 7.35, 125.45, 8.6];
    const bukidnonHotspotCount = hotspots.filter(
      (h) =>
        h.longitude >= bukidnonBbox[0] &&
        h.latitude >= bukidnonBbox[1] &&
        h.longitude <= bukidnonBbox[2] &&
        h.latitude <= bukidnonBbox[3]
    ).length;
    const bukidnonChild = childCounts.find(
      (c) =>
        c.regionId === "PH-BUK" || c.name.toLowerCase().includes("bukidnon")
    );
    const bukidnonCount = bukidnonChild?.count ?? bukidnonHotspotCount;
    const bukPriority = getPriorityStyle(bukidnonCount, summary?.label);

    const sortedChildren = [...childCounts]
      .filter((c) => (c.count ?? 0) > 0 && c.regionId !== "PH-BUK")
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 3);

    const bukidnonItem: WatchlistItem = {
      id: "watch-PH-BUK",
      title: "Bukidnon",
      subtitle: "Valencia · Malaybalay · Manolo Fortich · Maramag",
      badgeText: bukidnonCount > 0 ? bukPriority.badgeText : "WATCH",
      badgeColor: bukPriority.badgeColor,
      badgeTone: bukPriority.badgeTone,
      count: bukidnonCount,
      countLabel: `${bukidnonCount.toLocaleString("en-US")} hotspot${
        bukidnonCount === 1 ? "" : "s"
      }`,
      targetRegionId: bukidnonRegion?.id ?? "PH-BUK",
      actionLabel: "Monitor Bukidnon",
      isPinnedBukidnon: true,
    };

    const otherItems: WatchlistItem[] = sortedChildren.map((child, idx) => {
      const count = child.count ?? 0;
      const priority = getPriorityStyle(count, summary?.label);

      return {
        id: `watch-${child.regionId}`,
        title: child.name,
        subtitle: `Top #${idx + 1} provincial volume`,
        badgeText: idx === 0 ? "HIGH" : priority.badgeText,
        badgeColor:
          idx === 0
            ? "var(--hotspot-very-high, #ef4444)"
            : priority.badgeColor,
        badgeTone: idx === 0 ? "critical" : priority.badgeTone,
        count,
        countLabel: `${count.toLocaleString("en-US")} hotspot${
          count === 1 ? "" : "s"
        }`,
        targetRegionId: child.regionId,
        actionLabel: "View",
      };
    });

    return {
      scopeBadge: "National Priority",
      items: [bukidnonItem, ...otherItems],
      showQuickBukidnonJump: false,
    };
  }

  // CASE 3: ANY OTHER PROVINCE OR CUSTOM AREA
  const bbox = selectedRegion?.bbox ?? [120.0, 7.0, 126.0, 16.0];
  const minLat = bbox[1];
  const maxLat = bbox[3];
  const latSpan = Math.max(0.15, maxLat - minLat);
  const northCut = minLat + (latSpan * 2) / 3;
  const southCut = minLat + latSpan / 3;

  const localizedSectors = [
    {
      id: `${regionId}-north`,
      title: `Northern ${regionName}`,
      subtitle: "Northern sector",
      count: hotspots.filter((h) => h.latitude >= northCut).length,
    },
    {
      id: `${regionId}-central`,
      title: `Central ${regionName}`,
      subtitle: "Central corridor",
      count: hotspots.filter(
        (h) => h.latitude >= southCut && h.latitude < northCut
      ).length,
    },
    {
      id: `${regionId}-south`,
      title: `Southern ${regionName}`,
      subtitle: "Southern sector",
      count: hotspots.filter((h) => h.latitude < southCut).length,
    },
  ];

  const items: WatchlistItem[] = localizedSectors
    .map((sector) => {
      const priority = getPriorityStyle(sector.count, summary?.label);
      return {
        id: sector.id,
        title: sector.title,
        subtitle: sector.subtitle,
        badgeText: priority.badgeText,
        badgeColor: priority.badgeColor,
        badgeTone: priority.badgeTone,
        count: sector.count,
        countLabel: `${sector.count.toLocaleString("en-US")} hotspot${
          sector.count === 1 ? "" : "s"
        }`,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    scopeBadge: regionName,
    items,
    showQuickBukidnonJump: true,
  };
}

export function AssistantPanel({
  summary,
  liveCounts = null,
  hotspots = [],
  childCounts = [],
  regions = [],
  selectedRegion = null,
  onSelectRegion,
  onClose,
}: AssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<"advisory" | "watchlist">(
    "advisory"
  );
  const [question, setQuestion] = useState("");
  const [lastAskedQuestion, setLastAskedQuestion] = useState<string | null>(
    null
  );
  const [questionHint, setQuestionHint] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState(DEFAULT_DISCLAIMER);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const lastScopeKeyRef = useRef<string | null>(null);
  const answerSectionRef = useRef<HTMLDivElement | null>(null);
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollAnswerIntoView = useCallback(() => {
    const node = answerSectionRef.current;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const effectiveSummary = useMemo(
    () => (summary ? mergeLiveCountsIntoSummary(summary, liveCounts, hotspots) : null),
    [summary, liveCounts, hotspots]
  );

  useEffect(() => {
    return () => requestController.current?.abort();
  }, []);

  const requestAdvisory = useCallback(
    async (
      promptQuestion: string,
      activeSummary: AnalyticsSummaryForAi | null
    ) => {
      const trimmedQuestion = promptQuestion.trim();

      if (!activeSummary) {
        setError(
          "Select a region and month before asking for a data explanation."
        );
        return;
      }

      if (trimmedQuestion.length === 0) {
        setError("Enter a question or choose one of the suggested questions.");
        return;
      }

      if (trimmedQuestion.length > AI_MAX_QUESTION_LENGTH) {
        setError(
          `Keep the question under ${AI_MAX_QUESTION_LENGTH} characters.`
        );
        return;
      }

      const payloadSummary = mergeLiveCountsIntoSummary(
        activeSummary,
        liveCounts,
        hotspots
      );

      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;
      setIsLoading(true);
      setError(null);
      setAnswer(null);

      try {
        const response = await fetch("/api/ai/brief", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            summary: payloadSummary,
            question: trimmedQuestion,
          }),
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            getErrorMessage(body) ??
              "The AI interpretation could not be loaded."
          );
        }
        if (!isAiBriefResponse(body)) {
          throw new Error("The AI returned an invalid response.");
        }

        setAnswer(body.answer);
        setDisclaimer(body.disclaimer);
      } catch (caughtError) {
        if (
          caughtError instanceof DOMException &&
          caughtError.name === "AbortError"
        ) {
          return;
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The AI interpretation could not be loaded."
        );
      } finally {
        if (requestController.current === controller) {
          requestController.current = null;
          setIsLoading(false);
        }
      }
    },
    [liveCounts, hotspots]
  );

  // Reset answer & error when region/period changes so user can click "Get CDRRMO Advisory" for the new scope
  useEffect(() => {
    const scopeKey = summary
      ? `${summary.region.id}:${summary.period.year}-${summary.period.month}:${summary.metric}:${summary.instrument}`
      : selectedRegion?.id ?? "none";

    if (lastScopeKeyRef.current === scopeKey) {
      return;
    }
    lastScopeKeyRef.current = scopeKey;
    requestController.current?.abort();
    setIsLoading(false);
    setAnswer(null);
    setError(null);
    setLastAskedQuestion(null);
    setQuestionHint(null);
  }, [summary, selectedRegion]);

  function handleGenerateAdvisory() {
    if (!summary) {
      return;
    }
    setQuestionHint(null);
    setLastAskedQuestion(null);
    void requestAdvisory(DEFAULT_AUTO_QUESTION, summary);
  }

  function chooseSuggestedQuestion(value: string) {
    setQuestion(value);
    setQuestionHint(null);
    setError(null);
    setLastAskedQuestion(value);
    if (summary) {
      scrollAnswerIntoView();
      void requestAdvisory(value, summary);
    }
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      setQuestionHint(
        "Enter a specific question above or click one of the suggested prompts."
      );
      questionInputRef.current?.focus();
      return;
    }
    setQuestionHint(null);
    setLastAskedQuestion(trimmed);
    scrollAnswerIntoView();
    await requestAdvisory(trimmed, summary);
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const posture = useMemo(
    () => getDirectPosture(effectiveSummary),
    [effectiveSummary]
  );

  const watchlist = useMemo(
    () =>
      buildPriorityWatchlist(
        effectiveSummary,
        hotspots,
        childCounts,
        regions,
        selectedRegion
      ),
    [effectiveSummary, hotspots, childCounts, regions, selectedRegion]
  );

  const structuredBrief = useMemo(
    () => (answer ? parseStructuredAdvisory(answer) : null),
    [answer]
  );

  const viirsCount =
    effectiveSummary?.byInstrument.VIIRS ??
    hotspots.filter((h) => h.instrument === "VIIRS").length;
  const modisCount =
    effectiveSummary?.byInstrument.MODIS ??
    hotspots.filter((h) => h.instrument === "MODIS").length;
  const currentCount = effectiveSummary?.currentCount ?? hotspots.length;

  const regionName =
    summary?.region.name ?? selectedRegion?.name ?? "The Philippines";
  const periodLabel = summary
    ? `${summary.period.year}-${String(summary.period.month).padStart(2, "0")}`
    : "Live Window";

  return (
    <section
      aria-labelledby="assistant-panel-title"
      className="assistant-panel"
    >
      <div className="assistant-header">
        <div className="assistant-header-top">
          <div>
            <p className="assistant-eyebrow">CDRRMO AI · DECISION SUPPORT</p>
            <h2 id="assistant-panel-title" className="assistant-title">
              CDRRMO Fire Advisory
            </h2>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close CDRRMO Advisory AI"
              className="assistant-close-button"
            >
              ×
            </button>
          ) : null}
        </div>

        <div
          className="assistant-context-pill"
          aria-label="Active advisory scope"
        >
          <span>
            {regionName} · {periodLabel}
          </span>
        </div>

        <div
          className="assistant-tabs"
          role="tablist"
          aria-label="Advisory and Watchlist views"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px",
            marginTop: "12px",
            padding: "3px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "var(--surface-dim)",
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "advisory"}
            className={`assistant-tab${
              activeTab === "advisory" ? " is-active" : ""
            }`}
            onClick={() => setActiveTab("advisory")}
            style={{
              height: "32px",
              borderRadius: "4px",
              border:
                activeTab === "advisory"
                  ? "1px solid rgb(249 115 22 / 45%)"
                  : "1px solid transparent",
              background:
                activeTab === "advisory" ? "var(--accent-soft)" : "transparent",
              color:
                activeTab === "advisory" ? "#ffdbca" : "var(--muted)",
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Advisory
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "watchlist"}
            className={`assistant-tab${
              activeTab === "watchlist" ? " is-active" : ""
            }`}
            onClick={() => setActiveTab("watchlist")}
            style={{
              height: "32px",
              borderRadius: "4px",
              border:
                activeTab === "watchlist"
                  ? "1px solid rgb(249 115 22 / 45%)"
                  : "1px solid transparent",
              background:
                activeTab === "watchlist" ? "var(--accent-soft)" : "transparent",
              color:
                activeTab === "watchlist" ? "#ffdbca" : "var(--muted)",
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Watchlist ({watchlist.items.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: BUTTON-TRIGGERED CDRRMO ADVISORY */}
      <div
        className="assistant-advisory-view"
        hidden={activeTab !== "advisory"}
      >
        <div
          className={`assistant-direct-banner assistant-direct-banner--${posture.tone}`}
          aria-label="CDRRMO key metrics"
          style={{ marginTop: 0, padding: "10px 12px" }}
        >
          <div
            className="assistant-kpi-strip"
            role="list"
            style={{ marginTop: 0 }}
          >
            <div className="assistant-kpi-box" role="listitem">
              <span className="assistant-kpi-label">Hotspots</span>
              <strong className="assistant-kpi-value">
                {currentCount != null
                  ? currentCount.toLocaleString("en-US")
                  : "0"}
              </strong>
              <span className="assistant-kpi-sub">
                VIIRS {viirsCount ?? 0} · MODIS {modisCount ?? 0}
              </span>
            </div>
            <div className="assistant-kpi-box" role="listitem">
              <span className="assistant-kpi-label">Normal Median</span>
              <strong className="assistant-kpi-value">
                {summary?.historicalMedian != null
                  ? summary.historicalMedian.toLocaleString("en-US")
                  : "—"}
              </strong>
              <span className="assistant-kpi-sub">
                {summary?.baselineYears.length
                  ? `${summary.baselineYears.length}yr baseline`
                  : "Historical"}
              </span>
            </div>
            <div className="assistant-kpi-box" role="listitem">
              <span className="assistant-kpi-label">Status</span>
              <strong
                className={`assistant-kpi-value assistant-kpi-value--${posture.tone}`}
              >
                {summary?.anomalyPercent != null
                  ? `${summary.anomalyPercent > 0 ? "+" : ""}${summary.anomalyPercent.toFixed(1)}%`
                  : "Live"}
              </strong>
              <span className="assistant-kpi-sub">{posture.badge}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerateAdvisory}
          disabled={!summary || isLoading}
          className="assistant-submit assistant-generate-btn"
          style={{
            width: "100%",
            minHeight: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "12px",
            fontFamily: "var(--font-jetbrains-mono), monospace",
            letterSpacing: "0.02em",
          }}
        >
          {isLoading ? "Generating Advisory…" : "Get CDRRMO Advisory"}
        </button>

        <div ref={answerSectionRef} aria-live="polite" className="assistant-answer">
          {lastAskedQuestion ? (
            <p className="assistant-question-echo">
              <strong>Question:</strong> {lastAskedQuestion}
            </p>
          ) : null}
          {error ? (
            <p
              id="assistant-error"
              role="alert"
              className="assistant-error"
              style={{ marginTop: 0 }}
            >
              {error}
            </p>
          ) : null}

          {isLoading ? (
            <p className="assistant-answer-copy" style={{ marginTop: 0 }}>
              Generating CDRRMO advisory…
            </p>
          ) : answer && structuredBrief ? (
            <div
              className="assistant-brief-grid assistant-answer-result"
              style={{ marginTop: 0 }}
            >
              <article className="assistant-brief-card">
                <strong className="assistant-section-heading">
                  Summary{" "}
                  <span className="sr-only">Computed values:</span>
                </strong>
                <p className="assistant-brief-card-body">
                  {structuredBrief.computedValues}
                </p>
              </article>
              <article className="assistant-brief-card assistant-brief-card--highlight">
                <strong className="assistant-section-heading">
                  CDRRMO Action{" "}
                  <span className="sr-only">Interpretation:</span>
                </strong>
                <p className="assistant-brief-card-body">
                  {structuredBrief.interpretation}
                </p>
              </article>
              <article className="assistant-brief-card">
                <strong className="assistant-section-heading">
                  Note <span className="sr-only">Limitations:</span>
                </strong>
                <p className="assistant-brief-card-body">
                  {structuredBrief.limitations}
                </p>
              </article>
            </div>
          ) : answer ? (
            <p
              className="assistant-answer-copy assistant-answer-result"
              style={{ marginTop: 0 }}
            >
              {formatAdvisoryAnswer(answer)}
            </p>
          ) : (
            <p className="assistant-answer-copy" style={{ marginTop: 0 }}>
              Click <strong>Get CDRRMO Advisory</strong> above to generate a
              concise situational briefing for {regionName}.
            </p>
          )}
        </div>

        <details className="assistant-followup-details">
          <summary className="assistant-followup-summary">
            Ask a specific question (optional)
          </summary>
          <div
            className="assistant-suggestions"
            aria-label="Suggested questions"
          >
            {SUGGESTED_QUESTIONS.map((suggestedQuestion) => (
              <button
                key={suggestedQuestion}
                type="button"
                onClick={() => chooseSuggestedQuestion(suggestedQuestion)}
                disabled={!summary || isLoading}
                className="assistant-suggestion"
              >
                {suggestedQuestion}
              </button>
            ))}
          </div>
          <form className="assistant-form" onSubmit={submitQuestion}>
            <label htmlFor="assistant-question" className="sr-only">
              Question for the CDRRMO Advisory AI
            </label>
            <textarea
              ref={questionInputRef}
              id="assistant-question"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                if (questionHint) {
                  setQuestionHint(null);
                }
              }}
              onKeyDown={handleQuestionKeyDown}
              maxLength={AI_MAX_QUESTION_LENGTH}
              rows={2}
              placeholder="Ask a specific CDRRMO question…"
              className="assistant-question"
              aria-describedby="assistant-question-help assistant-error"
              disabled={isLoading || !summary}
            />
            {!summary ? (
              <p className="assistant-question-hint" role="status">
                Loading region analytics before questions can be submitted…
              </p>
            ) : questionHint ? (
              <p className="assistant-question-hint" role="status">
                {questionHint}
              </p>
            ) : null}
            <div className="assistant-form-footer">
              <p id="assistant-question-help" className="assistant-input-help">
                {question.length}/{AI_MAX_QUESTION_LENGTH}
              </p>
              <button
                type="submit"
                disabled={isLoading || !summary}
                className="assistant-submit"
              >
                {isLoading ? "Generating…" : "Ask Advisory"}
              </button>
            </div>
          </form>
        </details>
      </div>

      {/* VIEW 2: SEPARATE WATCHLIST TAB (ONLY ESSENTIAL INFO) */}
      <div
        className="assistant-watchlist-section"
        aria-labelledby="assistant-watchlist-heading"
        hidden={activeTab !== "watchlist"}
      >
        <div className="assistant-watchlist-header">
          <div className="assistant-watchlist-heading-group">
            <h3
              id="assistant-watchlist-heading"
              className="assistant-watchlist-title"
            >
              Places to Closely Monitor
            </h3>
            <span className="assistant-watchlist-badge assistant-watchlist-scope">
              {watchlist.scopeBadge}
            </span>
          </div>
          {watchlist.showQuickBukidnonJump && onSelectRegion ? (
            <button
              type="button"
              className="assistant-watchlist-jump"
              onClick={() => onSelectRegion("PH-BUK")}
            >
              Monitor Bukidnon
            </button>
          ) : null}
        </div>

        <div className="assistant-watchlist-list" role="list">
          {watchlist.items.map((item) => (
            <article
              key={item.id}
              role="listitem"
              className={`assistant-watchlist-item${
                item.isPinnedBukidnon
                  ? " assistant-watchlist-item--bukidnon"
                  : ""
              }`}
            >
              <div className="assistant-watchlist-item-top">
                <div className="assistant-watchlist-item-titles">
                  <h4 className="assistant-watchlist-item-name">
                    {item.title}
                  </h4>
                  <p className="assistant-watchlist-item-sub">
                    {item.subtitle}
                  </p>
                </div>
                <span
                  className={`assistant-watchlist-badge assistant-watchlist-badge--${item.badgeTone}`}
                  style={{
                    borderColor: item.badgeColor,
                    color: item.badgeColor,
                  }}
                >
                  {item.badgeText}
                </span>
              </div>

              <div className="assistant-watchlist-metrics">
                <span className="assistant-watchlist-count">
                  {item.countLabel}
                </span>
                {item.targetRegionId && onSelectRegion ? (
                  <button
                    type="button"
                    className="assistant-watchlist-action"
                    onClick={() => {
                      if (item.targetRegionId) {
                        onSelectRegion(item.targetRegionId);
                      }
                    }}
                  >
                    View
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>

      <p className="assistant-disclaimer">{disclaimer}</p>
    </section>
  );
}
