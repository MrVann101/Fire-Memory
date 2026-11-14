"use client";

import type { CalendarCell, CalendarResponse } from "@/contracts/types";
import type { ClientResource } from "@/hooks/useClientResource";

const countRamp = ["#fff1c7", "#f7bd4a", "#f28124", "#d7471f", "#8f2319"];
const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function colorForCount(count: number, maxCount: number): {
  backgroundColor: string;
  color: string;
} {
  const ratio = maxCount > 0 ? Math.log1p(count) / Math.log1p(maxCount) : 0;
  const index = Math.min(countRamp.length - 1, Math.floor(ratio * countRamp.length));
  return {
    backgroundColor: countRamp[index],
    color: index < 3 ? "#422317" : "#fff8ed",
  };
}

function cellDescription(cell: CalendarCell | undefined): string {
  if (!cell || cell.count === null) {
    return "No data";
  }
  if (cell.estimated) {
    return `Estimated, ${cell.count.toLocaleString("en-US")} detections`;
  }
  if (cell.count === 0) {
    return "0 detections";
  }
  return `${cell.count.toLocaleString("en-US")} detections`;
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

  return (
    <section className="analytics-panel calendar-panel" aria-labelledby="calendar-title">
      <div className="analytics-panel-heading">
        <div>
          <p className="eyebrow">LONG-TERM PATTERNS</p>
          <h2 id="calendar-title">Historical activity</h2>
        </div>
        <span className="panel-context">Monthly counts · UTC</span>
      </div>

      {resource.isLoading ? (
        <div className="calendar-empty" role="status" aria-live="polite">
          Loading calendar data…
        </div>
      ) : resource.error ? (
        <div className="calendar-empty calendar-error" role="alert">
          <span className="empty-state-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <h3>Calendar could not be loaded</h3>
            <p>{resource.error.message}</p>
          </div>
        </div>
      ) : cells.length === 0 ? (
        <div className="calendar-empty" role="status">
          <span className="empty-state-symbol" aria-hidden="true">
            i
          </span>
          <div>
            <h3>{resource.data ? "No calendar data" : "Calendar unavailable"}</h3>
            <p>
              {resource.data
                ? "There are no monthly values for this selection. No counts are inferred."
                : "Select a region and month to load calendar data."}
            </p>
          </div>
        </div>
      ) : (
        <div className="calendar-table-wrap" role="region" aria-label="Monthly activity by year">
          <table className="calendar-table">
            <thead>
              <tr>
                <th scope="col">Year</th>
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
                    const description = cellDescription(cell);
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
                                    ? "repeating-linear-gradient(45deg, transparent 0, transparent 4px, rgb(255 248 237 / 68%) 4px, rgb(255 248 237 / 68%) 6px)"
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
                            ? "No data"
                            : cell.estimated
                              ? `${cell.count?.toLocaleString("en-US")} est.`
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
      )}

      <div className="calendar-legend" aria-label="Calendar legend">
        <div className="calendar-legend-row">
          <span className="calendar-key">
            <span className="calendar-swatch no-data-swatch" aria-hidden="true" />
            No data
          </span>
          <span className="calendar-key">
            <span className="calendar-swatch zero-swatch" aria-hidden="true" />
            0 detections
          </span>
          <span className="calendar-key">
            <span className="calendar-swatch estimated-swatch" aria-hidden="true" />
            Estimated
          </span>
        </div>
        <div className="ramp-legend">
          <span>Lower count</span>
          <span className="ramp-swatches" aria-hidden="true">
            {countRamp.map((color) => (
              <span key={color} style={{ backgroundColor: color }} />
            ))}
          </span>
          <span>Higher count</span>
        </div>
      </div>
    </section>
  );
}
