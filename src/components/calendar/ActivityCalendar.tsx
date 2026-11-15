"use client";

import Link from "next/link";
import type { CalendarCell, CalendarResponse } from "@/contracts/types";
import type { ClientResource } from "@/hooks/useClientResource";
import { useDashboardFilters } from "@/components/dashboard/DashboardFiltersProvider";
import {
  getMonthName,
  getTranslations,
  type AppLanguage,
} from "@/lib/i18n/translations";

const countRamp = ["#f7b267", "#f49739", "#eb8220", "#cf4414", "#8b1c12"];
const countTextRamp = ["#1f140e", "#1f140e", "#1f140e", "#ffffff", "#ffffff"];
const monthInitials = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function getShortMonthNames(language: AppLanguage): string[] {
  return Array.from({ length: 12 }, (_, idx) =>
    getMonthName(idx + 1, language, true)
  );
}

function colorForCount(count: number, maxCount: number): {
  backgroundColor: string;
  color: string;
} {
  const ratio = maxCount > 0 ? Math.log1p(count) / Math.log1p(maxCount) : 0;
  const index = Math.min(countRamp.length - 1, Math.floor(ratio * countRamp.length));
  return {
    backgroundColor: countRamp[index],
    color: countTextRamp[index],
  };
}

function cellDescription(
  cell: CalendarCell | undefined,
  language: AppLanguage
): string {
  const t = getTranslations(language);
  if (!cell || cell.count === null) {
    return t.calendar.noData;
  }
  const formatted = cell.count.toLocaleString("en-US");
  if (cell.estimated) {
    return language === "ceb"
      ? `Gibanabana, ${formatted} ka deteksyon`
      : language === "fil"
        ? `Tinataya, ${formatted} na deteksyon`
        : `Estimated, ${formatted} detections`;
  }
  return t.map.popup.detectionsCount(cell.count);
}

export default function ActivityCalendar({
  resource,
  selectedYear,
  selectedMonth,
  onSelectMonth,
}: {
  resource: ClientResource<CalendarResponse>;
  selectedYear: number | null;
  selectedMonth: number | null;
  onSelectMonth: (year: number, month: number) => void;
}) {
  const { language } = useDashboardFilters();
  const t = getTranslations(language);
  const monthNames = getShortMonthNames(language);
  const cells = resource.data?.cells ?? [];
  const firstYear = cells.reduce(
    (first, cell) => Math.min(first, cell.year),
    Number.POSITIVE_INFINITY
  );
  const lastYear = cells.reduce(
    (last, cell) => Math.max(last, cell.year),
    Number.NEGATIVE_INFINITY
  );
  const years =
    cells.length > 0
      ? Array.from(
          { length: lastYear - firstYear + 1 },
          (_, index) => firstYear + index
        )
      : [];
  const cellByMonth = new Map(
    cells.map((cell) => [`${cell.year}-${cell.month}`, cell])
  );
  const maxCount = cells.reduce(
    (max, cell) => Math.max(max, cell.count ?? 0),
    0
  );

  const activeYear =
    selectedYear && Number.isFinite(selectedYear)
      ? selectedYear
      : years[years.length - 1] ?? null;
  const activeMonth =
    selectedMonth && selectedMonth >= 1 && selectedMonth <= 12
      ? selectedMonth
      : 1;
  const selectedCell =
    activeYear !== null
      ? cellByMonth.get(`${activeYear}-${activeMonth}`)
      : undefined;
  const prevYearCell =
    activeYear !== null
      ? cellByMonth.get(`${activeYear - 1}-${activeMonth}`)
      : undefined;
  const yoyText =
    selectedCell &&
    selectedCell.count !== null &&
    prevYearCell &&
    prevYearCell.count !== null &&
    prevYearCell.count > 0
      ? `${selectedCell.count >= prevYearCell.count ? "+" : ""}${(
          ((selectedCell.count - prevYearCell.count) / prevYearCell.count) *
          100
        ).toLocaleString("en-US", { maximumFractionDigits: 1 })}% vs ${activeYear! - 1}`
      : language === "ceb"
        ? "Walay pares sa miaging tuig"
        : language === "fil"
          ? "Walang kapareha sa nakaraang taon"
          : "No prior-year pair";

  let peakCell: CalendarCell | null = null;
  let observedCount = 0;
  let estimatedCount = 0;
  for (const cell of cells) {
    if (cell.count !== null) {
      observedCount += 1;
      if (!peakCell || (peakCell.count ?? -1) < cell.count) {
        peakCell = cell;
      }
    }
    if (cell.estimated) {
      estimatedCount += 1;
    }
  }
  const totalSlots = years.length * 12;
  const coveragePct =
    totalSlots > 0 ? Math.round((observedCount / totalSlots) * 100) : 0;

  const yearProfileValues =
    activeYear !== null
      ? monthNames.map(
          (_, idx) => cellByMonth.get(`${activeYear}-${idx + 1}`)?.count ?? null
        )
      : [];
  const yearProfileMax = yearProfileValues.reduce<number>(
    (acc, val) => (val !== null && val > acc ? val : acc),
    1
  );

  if (resource.isLoading) {
    return (
      <section className="calendar-workstation-state" aria-labelledby="calendar-title">
        <h2 id="calendar-title" className="sr-only">
          {t.calendar.title}
        </h2>
        <div className="calendar-empty" role="status" aria-live="polite">
          {t.calendar.statusLoading}
        </div>
      </section>
    );
  }

  if (resource.error) {
    return (
      <section className="calendar-workstation-state" aria-labelledby="calendar-title">
        <h2 id="calendar-title" className="sr-only">
          {t.calendar.title}
        </h2>
        <div className="calendar-empty calendar-error" role="alert">
          <span className="empty-state-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <h3>{t.calendar.statusUnavailable}</h3>
            <p>{resource.error.message}</p>
          </div>
        </div>
      </section>
    );
  }

  if (cells.length === 0) {
    return (
      <section className="calendar-workstation-state" aria-labelledby="calendar-title">
        <h2 id="calendar-title" className="sr-only">
          {t.calendar.title}
        </h2>
        <div className="calendar-empty" role="status">
          <span className="empty-state-symbol" aria-hidden="true">
            i
          </span>
          <div>
            <h3>{resource.data ? t.calendar.noData : t.calendar.statusUnavailable}</h3>
            <p>{t.calendar.statusEmpty}</p>
          </div>
        </div>
      </section>
    );
  }

  const periodCode =
    activeYear !== null
      ? `${activeYear}-${String(activeMonth).padStart(2, "0")}`
      : "—";
  const mobileYears = [...years].reverse();

  const statusTagLabel =
    selectedCell?.estimated && selectedCell.count !== null
      ? t.calendar.legendEstimated.toUpperCase()
      : !selectedCell || selectedCell.count === null
        ? t.calendar.noData.toUpperCase()
        : t.calendar.recordedData.toUpperCase();

  const selectedLabel =
    language === "ceb" ? "Napili:" : language === "fil" ? "Napili:" : "Selected:";
  const peakLabel =
    language === "ceb"
      ? "Kinatas-an:"
      : language === "fil"
        ? "Pinakamataas:"
        : "Peak:";
  const coverageLabel =
    language === "ceb" ? "Sakop:" : language === "fil" ? "Saklaw:" : "Coverage:";
  const estimatedLabel =
    language === "ceb"
      ? "Gibanabana:"
      : language === "fil"
        ? "Tinataya:"
        : "Estimated:";
  const mosUnit =
    language === "ceb" ? "ka buwan" : language === "fil" ? "buwan" : "mos";
  const yearColLabel =
    language === "ceb" ? "Tuig" : language === "fil" ? "Taon" : "Year";
  const selectedPeriodEyebrow =
    language === "ceb"
      ? "Napiling Panahon"
      : language === "fil"
        ? "Napiling Panahon"
        : "Selected Period";
  const intensityScaleEyebrow =
    language === "ceb"
      ? "Sukdanan sa Kakusog (Log)"
      : language === "fil"
        ? "Antas ng Tindi (Log)"
        : "Intensity Scale (Log)";

  return (
    <>
      <section
        className="calendar-workstation-grid"
        aria-labelledby="calendar-title"
      >
      <div className="calendar-matrix-pane">
        <div className="calendar-telemetry-strip">
          <h2 id="calendar-title" className="sr-only">
            {t.calendar.title}
          </h2>
          <div className="telemetry-stat">
            <span className="telemetry-stat-label">{selectedLabel}</span>
            <span className="telemetry-stat-value">
              {selectedCell && selectedCell.count !== null
                ? `${periodCode} (${selectedCell.count.toLocaleString("en-US")})`
                : `${periodCode} (${t.calendar.noData})`}
            </span>
          </div>
          <div className="telemetry-stat">
            <span className="telemetry-stat-label">{peakLabel}</span>
            <span className="telemetry-stat-value">
              {peakCell && peakCell.count !== null
                ? `${peakCell.year}-${String(peakCell.month).padStart(2, "0")} (${peakCell.count.toLocaleString("en-US")})`
                : "—"}
            </span>
          </div>
          <div className="telemetry-stat">
            <span className="telemetry-stat-label">{coverageLabel}</span>
            <span className="telemetry-stat-value">
              {observedCount}/{totalSlots} {mosUnit} ({coveragePct}%)
            </span>
          </div>
          <div className="telemetry-stat">
            <span className="telemetry-stat-label">{estimatedLabel}</span>
            <span className="telemetry-stat-value">
              {estimatedCount} {mosUnit}
            </span>
          </div>
        </div>

        <div
          className="calendar-table-wrap calendar-matrix-scroll"
          role="region"
          aria-label={t.calendar.sameMonthYearOverYear}
        >
          <table className="calendar-table calendar-table-fluid">
            <thead>
              <tr>
                <th scope="col">{yearColLabel}</th>
                {monthNames.map((month) => (
                  <th scope="col" key={month}>
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((year) => (
                <tr key={year}>
                  <th scope="row">{year}</th>
                  {monthNames.map((_, monthIndex) => {
                    const month = monthIndex + 1;
                    const cell = cellByMonth.get(`${year}-${month}`);
                    const description = cellDescription(cell, language);
                    const isNoData = !cell || cell.count === null;
                    const className = [
                      "calendar-cell",
                      isNoData
                        ? "calendar-cell-no-data"
                        : cell.estimated
                          ? "calendar-cell-estimated"
                          : cell.count === 0
                            ? "calendar-cell-zero"
                            : "calendar-cell-count",
                      selectedYear === year && selectedMonth === month
                        ? "calendar-cell-selected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <td key={month}>
                        <button
                          type="button"
                          className={className}
                          style={
                            cell && cell.count !== null && cell.count > 0
                              ? {
                                  ...colorForCount(cell.count, maxCount),
                                  backgroundImage: cell.estimated
                                    ? "repeating-linear-gradient(45deg, transparent 0, transparent 4px, rgb(255 255 255 / 42%) 4px, rgb(255 255 255 / 42%) 6px)"
                                    : undefined,
                                }
                              : undefined
                          }
                          aria-label={`${monthNames[monthIndex]} ${year}: ${description}`}
                          aria-pressed={
                            selectedYear === year && selectedMonth === month
                          }
                          title={`${monthNames[monthIndex]} ${year}: ${description}`}
                          onClick={() => onSelectMonth(year, month)}
                        >
                          {isNoData
                            ? "—"
                            : cell.count?.toLocaleString("en-US")}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="calendar-inspector-rail" aria-label={t.calendar.railTitleEmpty}>
        <div className="inspector-section">
          <div className="inspector-heading-row">
            <span className="inspector-eyebrow">{selectedPeriodEyebrow}</span>
            <span className="inspector-status-tag">{statusTagLabel}</span>
          </div>
          <div className="inspector-period-title">
            {activeYear !== null ? `${monthNames[activeMonth - 1]} ${activeYear}` : t.calendar.noData}
          </div>
          <div className="inspector-count-readout">
            {selectedCell && selectedCell.count !== null
              ? `${selectedCell.count.toLocaleString("en-US")} cell-days`
              : t.shell.summaryCard.noSavedDetections}
          </div>
          <div className="inspector-yoy-row">
            <span>YoY:</span>
            <strong>{yoyText}</strong>
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-eyebrow">
            {activeYear !== null
              ? language === "ceb"
                ? `Mga Buwan sa ${activeYear}`
                : language === "fil"
                  ? `Mga Buwan ng ${activeYear}`
                  : `${activeYear} Monthly Profile`
              : t.calendar.railTitleEmpty}
          </div>
          <div className="inspector-profile-bars" aria-hidden="true">
            {yearProfileValues.map((val, idx) => {
              const heightPct =
                val !== null && val > 0
                  ? Math.max(8, Math.round((val / yearProfileMax) * 100))
                  : 4;
              const isSelectedBar = idx + 1 === activeMonth;
              return (
                <div
                  key={monthNames[idx]}
                  className={`inspector-bar${isSelectedBar ? " is-selected" : ""}`}
                  style={{ height: `${heightPct}%` }}
                />
              );
            })}
          </div>
          <div className="inspector-profile-axis">
            <span>{monthNames[0]}</span>
            <span>{monthNames[5]}</span>
            <span>{monthNames[11]}</span>
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-eyebrow">{intensityScaleEyebrow}</div>
          <div className="inspector-ramp-bar" aria-hidden="true">
            {countRamp.map((color) => (
              <span key={color} style={{ backgroundColor: color }} />
            ))}
          </div>
          <div className="inspector-ramp-labels">
            <span>{t.calendar.legendLess}</span>
            <span>{t.calendar.legendMore}</span>
          </div>
          <div className="inspector-key-list">
            <span className="calendar-key">
              <span className="calendar-swatch no-data-swatch" aria-hidden="true" />
              — {t.calendar.legendNoData}
            </span>
            <span className="calendar-key">
              <span className="calendar-swatch zero-swatch" aria-hidden="true" />
              {t.map.popup.detectionsCount(0)}
            </span>
            <span className="calendar-key">
              <span className="calendar-swatch estimated-swatch" aria-hidden="true" />
              {t.calendar.statusEstimated}
            </span>
          </div>
        </div>

        <div className="inspector-footer-action">
          <Link href="/" className="inspector-map-cta">
            {language === "ceb"
              ? `Tan-awa ang ${periodCode} sa Mapa →`
              : language === "fil"
                ? `Tingnan ang ${periodCode} sa Mapa →`
                : `View ${periodCode} on Map →`}
          </Link>
        </div>
      </aside>
    </section>

      <section
        className="calendar-mobile-view"
        aria-label={t.calendar.title}
      >
        <div
          className="mobile-year-pills"
          role="tablist"
          aria-label={yearColLabel}
        >
          {mobileYears.map((year) => {
            const isSelectedYear = year === activeYear;
            return (
              <button
                key={year}
                type="button"
                role="tab"
                aria-selected={isSelectedYear}
                className={`mobile-year-pill${isSelectedYear ? " is-active" : ""}`}
                onClick={() => onSelectMonth(year, activeMonth)}
              >
                {year}
              </button>
            );
          })}
        </div>

        <div className="mobile-hero-panel">
          <div className="mobile-hero-top">
            <div>
              <div className="mobile-hero-eyebrow">
                {activeYear !== null
                  ? `${monthNames[activeMonth - 1]} ${activeYear}`
                  : t.calendar.noData}{" "}
                · {statusTagLabel}
              </div>
              <div className="mobile-hero-count">
                {selectedCell && selectedCell.count !== null ? (
                  <>
                    {selectedCell.count.toLocaleString("en-US")}{" "}
                    <span>cell-days</span>
                  </>
                ) : (
                  <span>{t.calendar.noData}</span>
                )}
              </div>
            </div>
            <div className="mobile-hero-meta">
              <div className="mobile-hero-yoy">{yoyText}</div>
              <div className="mobile-hero-peak">
                {peakLabel.replace(":", "")} {yearProfileMax.toLocaleString("en-US")}
              </div>
            </div>
          </div>

          <div
            className="mobile-bar-chart"
            role="group"
            aria-label={`${activeYear ?? ""} ${t.calendar.sameMonthYearOverYear}`}
          >
            <div className="mobile-bars-row">
              {yearProfileValues.map((val, idx) => {
                const month = idx + 1;
                const isSel = month === activeMonth;
                const heightPct =
                  val !== null && val > 0
                    ? Math.max(12, Math.round((val / yearProfileMax) * 100))
                    : 8;
                const barColor =
                  val !== null && val > 0
                    ? colorForCount(val, maxCount).backgroundColor
                    : "var(--surface-container-high)";
                return (
                  <button
                    key={monthNames[idx]}
                    type="button"
                    className={`mobile-bar-btn${isSel ? " is-selected" : ""}`}
                    aria-label={`${monthNames[idx]} ${activeYear ?? ""}: ${cellDescription(
                      activeYear !== null
                        ? cellByMonth.get(`${activeYear}-${month}`)
                        : undefined,
                      language
                    )}`}
                    aria-pressed={isSel}
                    onClick={() =>
                      activeYear !== null && onSelectMonth(activeYear, month)
                    }
                  >
                    <span
                      className="mobile-bar-fill"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mobile-bars-axis" aria-hidden="true">
              {monthInitials.map((initial, idx) => (
                <span
                  key={`${initial}-${idx}`}
                  className={idx + 1 === activeMonth ? "is-selected" : ""}
                >
                  {initial}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mobile-month-list">
          {yearProfileValues.map((val, idx) => {
            const month = idx + 1;
            const cell =
              activeYear !== null
                ? cellByMonth.get(`${activeYear}-${month}`)
                : undefined;
            const isSel = month === activeMonth;
            const widthPct =
              val !== null && val > 0
                ? Math.max(6, Math.round((val / yearProfileMax) * 100))
                : 0;
            const barColor =
              val !== null && val > 0
                ? colorForCount(val, maxCount).backgroundColor
                : "transparent";

            return (
              <button
                key={monthNames[idx]}
                type="button"
                className={`mobile-month-row${isSel ? " is-selected" : ""}`}
                aria-pressed={isSel}
                onClick={() =>
                  activeYear !== null && onSelectMonth(activeYear, month)
                }
              >
                <span className="mobile-month-name">{monthNames[idx]}</span>
                <span className="mobile-month-track" aria-hidden="true">
                  <span
                    className="mobile-month-fill"
                    style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                  />
                </span>
                <span className="mobile-month-val">
                  {val === null
                    ? "—"
                    : cell?.estimated
                      ? `${val.toLocaleString("en-US")} ${t.shell.summaryCard.estimatedSuffix}`
                      : val.toLocaleString("en-US")}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mobile-bottom-dock">
          <span className="mobile-dock-period">
            {periodCode} {selectedLabel.replace(":", "").toLowerCase()}
          </span>
          <Link href="/" className="mobile-map-cta">
            {t.calendar.viewOnMap}
          </Link>
        </div>
      </section>
    </>
  );
}
