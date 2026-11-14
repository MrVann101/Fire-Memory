# Member 4 Actionable Task Plan — AI, Export & Presentation (`5d2b80c` Verified State)

> **Source of truth verified against:** `FIRE_MEMORY_Work_Plan.md`, `FIRE_MEMORY_Project_Documentation_Philippines.md`, `FIRE_MEMORY_Agent_Prompts.md`, `docs/implementation/00-overview.md`, `docs/implementation/member-4-ai-export.md`, `src/app/api/{ai,export}/**/*.ts`, `src/lib/{ai,export}/*.ts`, `src/components/{assistant,export}/*.tsx`, `tests/ai/*.test.mjs`, `docs/presentation/*.md`, `docs/DEMO_SCRIPT.md`, and live runtime verification on `next start`.

---

## 1. Current Verified State (`5d2b80c`)

| Area | Status | Exact Verified State |
|---|---|---|
| AI Guardrails & Prompt Layer | `[x]` Built | `src/lib/ai/{request,prompt,brief,config}.ts`, `src/app/api/ai/brief/route.ts`, and `src/components/assistant/AssistantPanel.tsx` implement strict Zod schema, `1,000`-char question cap, untrusted input delimiters, pre-call evacuation/prediction refusal, and numeric grounding check. |
| CSV Library & UI Components | `[x]` Built | `src/lib/export/{csv,types}.ts` & `src/components/export/ExportButton.tsx` exist. |
| AI Test Suite Status | `[!]` **PARTIAL / FAILING** | `tests/ai/m4-t1.test.mjs` & `m4-t4.test.mjs` pass `5/5` **only** with `--import ./tests/analytics/register-paths.mjs`. Default `node --test tests/ai/*.test.mjs` fails `2/4` files (`ERR_MODULE_NOT_FOUND`). **`tests/ai/m4-t2.test.mjs` FAILS even with `--import`** (`gaxios/package.json` `SyntaxError` under Node 24 loader importing `@google/genai`). |
| **CRITICAL: Export Routes Broken (`400`)** | `[!]` **CRITICAL BUG** | **Live `next start` test failed (`400 INVALID_EXPORT_REQUEST`)!** Both `src/app/api/export/csv/route.ts:42,50,52` and `src/app/api/export/analytics-csv/route.ts:36,49,53` pass `searchParams.get("bbox")` (`null` when absent) into Zod `bboxSchema.optional()`, which rejects `null`! Non-custom exports crash 100% of the time unless `bbox` is passed! |
| **HIGH: Fragile Export Self-Fetch** | `[!]` **HIGH BUG** | `csv/route.ts:93-96` & `analytics-csv/route.ts:96-108` do `fetch(new URL("/api/...", request.url))` back to Next.js itself instead of calling backend helpers in-process (`queryHotspots`, `getCalendar`, `getAnalyticsSummary`). Breaks under Vercel deployment protection / proxies and doubles request overhead. |
| **CSV Formula & Period Gaps** | `[!]` **MEDIUM BUG** | `src/lib/export/csv.ts:27` checks `/^[=+\-@]/` — misses leading `\t` and `\r` formula prefixes. `ExportButton.tsx:10-53` lacks `year`/`month` props needed by `/api/export/analytics-csv` (`analytics-csv/route.ts:37-42`), so historical analytics exports default to today's UTC month. |
| **AI Model Name & Env Key** | `[!]` **BLOCKER** | `.env.local` has **no `GEMINI_API_KEY`** (`503 AI_NOT_CONFIGURED`). `src/lib/ai/config.ts:1` hardcodes `GEMINI_MODEL = "gemini-3.8-flash"` without `VERIFY` confirmation against official Gemini API model docs. `brief.ts:202` catches all SDK errors into generic `AiProviderError` (hides 429 vs 404/invalid model in server logs). |
| **Slots Unmounted** | `[!]` **MISSING INTEGRATION** | `<AssistantPanel />` and `<ExportButton />` are still not mounted inside `DashboardShell.tsx:846-857` (coordinate with `@frontend`). |
| **Presentation & Demo Verification** | `[ ]` **NOT READY** | `docs/presentation/4-slide-pitch.md` has `VERIFY` placeholders on lines `4, 13, 21, 95` and `7/7` unchecked submission items (`113-119`); `judge-questions.md` has `5/5` unchecked items (`73-79`); `DEMO_SCRIPT.md` has `6/6` unchecked rehearsal/video items (`111-116`). |

---

## 2. Role Summary

Member 4 owns the grounded Gemini AI briefing endpoint (`/api/ai/brief`), CSV export routes (`/api/export/csv`, `/api/export/analytics-csv`), the UI components (`<AssistantPanel />`, `<ExportButton />`), and final Space Apps pitch/demo deliverables. Right now both CSV export endpoints fail with HTTP `400` on standard regions due to a `null` `bbox` Zod bug, the AI model name and `GEMINI_API_KEY` are unverified, `m4-t2.test.mjs` crashes on import, and the pitch deck still contains `VERIFY` placeholders.

---

## 3. Your Files & Ownership Boundaries

**Allowed paths (`FIRE_MEMORY_Work_Plan.md:109` & `scripts/check-owner.sh:7`):**
- `src/app/api/ai/**`
- `src/app/api/export/**`
- `src/lib/ai/**`
- `src/lib/export/**`
- `src/components/assistant/**`
- `src/components/export/**`
- `tests/ai/**`
- `docs/presentation/**`
- `docs/DEMO_SCRIPT.md`
- `docs/implementation/member-4-*.md`

**DO NOT TOUCH:**
- `src/components/dashboard/**`, `src/app/{page,layout,globals}.*`, `src/lib/db/**`, `src/lib/analytics/**`, `supabase/**`, `scripts/ingest/**`, `data/**`, `src/content/**`
- `src/contracts/**`, `src/mocks/**`, `package.json`, `next.config.ts` (locked shared files).

---

## 4. What You Provide & What You Depend On

**You provide to Member 3 (`@frontend`):**
- `<AssistantPanel summary={summary.data} />` (`src/components/assistant/AssistantPanel.tsx`)
- `<ExportButton filters={hotspotFilters} metric={metric} year={periodRange.year} month={periodRange.month} />` (`src/components/export/ExportButton.tsx`)

**You depend on:**
- **Member 2 (`@backend`):** Direct in-process call permission/signatures for `queryHotspots`, `getCalendar`, `getAnalyticsSummary` (`src/lib/db/hotspots.ts`, `src/lib/analytics/{calendar,summary}.ts`).
- **Member 3 (`@frontend`):** Mounting `<AssistantPanel />` & `<ExportButton />` in `DashboardShell.tsx:846-857`.
- **Member 1 (`@data`):** Verified post-load production counts and validation numbers (`docs/DATA.md`, `docs/HARMONIZATION.md`) for Slide 1 and Judge Q&A.

---

## 5. Environment Variables You Use

| Variable | Status in `.env.local` | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `[ ]` **MISSING** | Required server-side key for `GoogleGenAI` (`src/lib/ai/brief.ts:171`). Add to `.env.local` and Vercel dashboard; NEVER `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | `[!]` Hardcoded `"gemini-3.8-flash"` in `config.ts:1` | Confirm valid active model ID in official Google Gemini API docs; optionally read `process.env.GEMINI_MODEL` with a verified default! |

---

## 6. MVP Scope & Execution Priority (`MVP-MUST` First + Demo Required)

| Priority | Task ID | Status | Target Deliverable |
|---|---|---|---|
| `MVP-SHOULD` | **M4-T1** | `[!]` **CRITICAL FIX** | Fix `bbox ?? undefined` `400` bug in **both** `src/app/api/export/csv/route.ts` and `analytics-csv/route.ts`, replace HTTP self-fetch with direct backend function calls (once agreed with `@backend`), and fix `\t`/`\r` CSV formula guard. |
| `MVP-SHOULD` | **M4-T2** | `[!]` **BLOCKER FIX** | Verify active Gemini model ID from official docs (`src/lib/ai/config.ts:1`), configure `GEMINI_API_KEY` in `.env.local` + Vercel, improve non-secret server error logging/handling, and fix `tests/ai/m4-t2.test.mjs` Node 24 import crash. |
| `MVP-SHOULD` | **M4-T3** | `[!]` Fix + Integration | Add optional `year` & `month` props to `<ExportButton />` (or derive from `filters.start`), coordinate with `@frontend` to mount `<AssistantPanel />` & `<ExportButton />` in `DashboardShell.tsx`. |
| `MVP-SHOULD` | **M4-T4** | `[ ]` Add Tests | Add route tests for `/api/ai/brief` (`400` bad JSON, `413` oversized body, `503` missing key) and `/api/export/{csv,analytics-csv}` (`regionId` without `bbox` returning `200`, `custom` without `bbox` returning `400`, CSV headers & BOM). |
| **SUBMISSION-REQ** | **M4-T5** | `[ ]` Incomplete | Complete `docs/presentation/4-slide-pitch.md` (`VERIFY` placeholders + all `7/7` submission checks) and `judge-questions.md` (`5/5` factual checks) using Member 1's loaded DB metrics. |
| **SUBMISSION-REQ** | **M4-T6** | `[ ]` Incomplete | Rehearse `docs/DEMO_SCRIPT.md`, verify live deployed URL, and record the **90-second backup video** (`6/6` checks). |
| `NICE` | **M4-T7** | `[ ]` Optional | Create `src/lib/export/pdf.ts` text-first emergency briefing report **only** after all items above are green and live-tested. |

---

## 7. Actionable Task List

### M4-T1 (`MVP-SHOULD`) `[!]` Fix Both CSV Export Routes (`bbox` `400` Bug, Self-Fetch, Formula Escaping)
- **Objective:** Eliminate the guaranteed HTTP `400` failure on all non-custom CSV exports, remove fragile HTTP self-fetching, and complete OWASP CSV injection escaping.
- **Files:** `src/app/api/export/csv/route.ts`, `src/app/api/export/analytics-csv/route.ts`, `src/lib/export/csv.ts`
- **Steps:**
  1. In `src/app/api/export/csv/route.ts:42` and `src/app/api/export/analytics-csv/route.ts:36`: change `const bbox = searchParams.get("bbox");` -> `const bbox = searchParams.get("bbox") ?? undefined;` (so absent `bbox` passes Zod `.optional()` instead of failing on `null`).
  2. Replace self-`fetch(new URL("/api/...", request.url))` in `csv/route.ts:93-96` with direct call to `queryHotspots(...)` (`@/lib/db/hotspots`) with `limit = 10_000`, mapping `AppValidationError`/`RegionNotFoundError` to `400`/`404` and preserving `X-Fire-Memory-Truncated`.
  3. Replace self-`fetch` in `analytics-csv/route.ts:96-108` with direct `Promise.all([getCalendar(...), getAnalyticsSummary(...)])` (`@/lib/analytics/{calendar,summary}`), formatting `bbox` as `[number, number, number, number]` cleanly via the shared `bboxSchema`. Also verify/document clearly why non-selected months in `analytics-csv/route.ts:136-147` leave `historicalMedian`/`anomalyPercent`/`label` blank (or leave as designed).
  4. In `src/lib/export/csv.ts:27`: update `protectSpreadsheetFormula` regex from `/^[=+\-@]/` to `/^[=+\-@\t\r]/`.
  5. Reconcile `filename` header note (`docs/implementation/member-4-ai-export.md:251` checked despite `analytics-csv` returning `200` only when `bbox` is manually supplied; verify actual live headers!).
- **Acceptance criteria:** `GET /api/export/csv?regionId=PH-BUK&start=2026-11-01&end=2026-11-14&instrument=ALL` and `GET /api/export/analytics-csv?regionId=PH-BUK&metric=harmonized&year=2026&month=11` BOTH return HTTP `200`, UTF-8 BOM `\uFEFF`, `Content-Type: text/csv; charset=utf-8`, and valid escaped CSV without making loopback HTTP requests.
- **How to verify:** Test both endpoints via `curl.exe` / `Invoke-WebRequest` against `next start`, verifying `200` with and without `bbox`, and `400` when `regionId=custom` has no `bbox`.
- **Needs from others:** Confirm in-process imports with `@backend` (`M2-T5`).

### M4-T2 (`MVP-SHOULD`) `[!]` Fix `GEMINI_MODEL`, Configure `GEMINI_API_KEY`, & Repair `m4-t2.test.mjs`
- **Objective:** Make `/api/ai/brief` actually work against the live Gemini API and make the AI test suite runnable under Node 24 without loader errors.
- **Files:** `src/lib/ai/config.ts`, `src/lib/ai/brief.ts`, `tests/ai/m4-t2.test.mjs`
- **Steps:**
  1. Check official Google Gemini API docs (`ai.google.dev`) for the active Flash model ID (replace unverified `"gemini-3.8-flash"` in `src/lib/ai/config.ts:1`, e.g., `process.env.GEMINI_MODEL?.trim() || "<verified-official-model-id>"` with clear comment).
  2. Obtain and add `GEMINI_API_KEY` into local `.env.local` and Vercel Environment Variables (never commit `.env.local`).
  3. In `src/lib/ai/brief.ts:202`: log sanitized failure metadata (`error.name` / status without API keys) before throwing `AiProviderError` so Vercel logs distinguish `404 model not found` vs `429 rate limit` vs `timeout`.
  4. Fix `tests/ai/m4-t2.test.mjs` failing on `gaxios/package.json` under Node 24 ES module loader (root cause: `register-paths.mjs` custom loader resolves `@/` + `.ts`, causing `tests/ai/m4-t2.test.mjs:9` importing `route.ts` -> `brief.ts` -> `@google/genai` -> `gaxios` JSON import issue when `--import ./tests/analytics/register-paths.mjs` intercepts or Node loader lacks type/import attributes). Test loading `brief.ts` or mocking/isolating `@google/genai` cleanly so `m4-t2.test.mjs` passes `100%`!
- **Acceptance criteria:** `m4-t1.test.mjs`, `m4-t2.test.mjs`, and `m4-t4.test.mjs` all pass `100%`; `POST /api/ai/brief` with a real `AnalyticsSummary` and `GEMINI_API_KEY` returns `200` with `Computed values:`, `Interpretation:`, `Limitations:`, and `disclaimer`.
- **How to verify:** Run `node --import ./tests/analytics/register-paths.mjs --test tests/ai/*.test.mjs` (`0` failures) + live `curl -X POST /api/ai/brief` test on `next start`.

### M4-T3 (`MVP-SHOULD`) `[!]` Add `year`/`month` Period Alignment to `ExportButton.tsx` & Coordinate Mounting
- **Objective:** Ensure clicking `Analytics CSV` exports the user's selected month/year (not always current UTC month) and assist `@frontend` with mounting both components.
- **Files:** `src/components/export/ExportButton.tsx`
- **Steps:**
  1. Add optional `year?: number; month?: number;` to `ExportButtonProps` (`ExportButton.tsx:10-13`), defaulting cleanly from `filters.start.slice(0, 4)` / `filters.start.slice(5, 7)` if omitted.
  2. Pass `year` and `month` in `queryString` (`ExportButton.tsx:34-51`) when `kind === "analytics"`.
  3. Notice `<AssistantPanel />` & `<ExportButton />` use Tailwind utility classes (`rounded-2xl`, `p-5`, etc.) — verify readability and visual alignment once `@frontend` completes `M3-T3` & `M3-T4`.
- **Acceptance criteria:** Exporting Analytics CSV for historical month `2024-03` sends `?year=2024&month=3` and puts median/anomaly columns on row `(2024, 3)`.

### M4-T4 (`MVP-SHOULD`) `[ ]` Add Route Tests for `/api/export/*` & `/api/ai/brief` Edge Cases
- **Objective:** Automated regression protection for export validation (`bbox` omitted vs `custom` without `bbox`), formula escaping (`\t`, `\r`), and AI request size/JSON error codes.
- **Files:** `tests/ai/m4-t3.test.mjs` or expand `tests/ai/m4-t4.test.mjs` & `m4-t2.test.mjs`.
- **Steps:** Add tests exercising: (a) `/api/ai/brief` invalid JSON -> `400`, `>100KB` body -> `413`, missing key -> `503`; (b) `/api/export/csv` & `analytics-csv` request parsing without `bbox` (`200` vs mock) and `regionId=custom` without `bbox` (`400`); (c) CSV escaping for leading `\t` and `\r`.
- **Acceptance criteria:** All tests under `tests/ai/*.test.mjs` pass `100%` with zero skipped cases.

### M4-T5 (`SUBMISSION-REQUIRED`) `[ ]` Replace `VERIFY` Placeholders in Pitch & Judge Docs
- **Objective:** Make `docs/presentation/4-slide-pitch.md` and `docs/presentation/judge-questions.md` 100% factual and submission-ready once Member 1 seeds live Supabase.
- **Files:** `docs/presentation/4-slide-pitch.md`, `docs/presentation/judge-questions.md`
- **Steps:**
  1. Confirm the official 2026 NASA Space Apps challenge title, team registration, submission deadline, and live deployed Vercel URL.
  2. Replace `VERIFY` placeholders (`4-slide-pitch.md:4, 13, 21, 95`) with verified post-seeding numbers from Member 1 (`docs/HARMONIZATION.md` / `docs/DATA.md`) — e.g., national VIIRS/MODIS ratio (`4.0978` on 2020–2025 or updated full-history number), overlap months/correlation, raw detection count.
  3. Complete all checkboxes in `4-slide-pitch.md:113-119` and `judge-questions.md:73-79`.
- **Acceptance criteria:** Zero `VERIFY` or URL/number placeholders remain in `docs/presentation/*.md`.

### M4-T6 (`SUBMISSION-REQUIRED`) `[ ]` Rehearse `docs/DEMO_SCRIPT.md` & Record 90-Second Backup Video
- **Objective:** Guarantee a timed, smooth 2:30 live walkthrough plus an insurance backup video before submission closes.
- **Files:** `docs/DEMO_SCRIPT.md`
- **Steps:** Rehearse after live DB (`NEXT_PUBLIC_USE_MOCKS=false`) and Vercel deploy are verified; verify clean screen recording <= 90 seconds showing National -> Bukidnon -> Raw vs Harmonized -> Overlap chart -> Calendar -> AI Assistant -> CSV Export; check off `docs/DEMO_SCRIPT.md:111-116`.
- **Acceptance criteria:** Live demo + backup video exist and match actual deployed UI and metrics.

### M4-T7 (`NICE`) `[ ]` Optional Printable / PDF Briefing (`src/lib/export/pdf.ts`)
- **Objective:** Only if time remains after M4-T1..M4-T6 are completely verified, add clean printable summary view or text-first briefing export following `FIRE_MEMORY_Project_Documentation_Philippines.md` section `5.5`.
- **Files:** `src/lib/export/pdf.ts` (do not add heavy unvetted dependencies unless agreed by team in locked `package.json`).

---

## 8. Edge Cases & Honesty Rules

- **Ground strictly in payload:** Prompt and post-validator (`brief.ts`) must never invent counts, years, or locations absent from `AnalyticsSummary`.
- **Untrusted user question:** Prompt delimiters + pre-check must reject/refuse evacuation orders and spread forecasts deterministically.
- **No stack traces or keys in errors:** Never leak `GEMINI_API_KEY` or raw stack traces from `/api/ai/brief` or `/api/export/*`.

---

## 9. Verification Commands

```bash
npm run lint
npx tsc --noEmit
node --import ./tests/analytics/register-paths.mjs --test tests/ai/*.test.mjs
```

---

## 10. Handoff Checklist

- [ ] `M4-T1`: Export routes return `200` when `bbox` is absent (`csv` & `analytics-csv`), call backend helpers directly (no self-fetch), and escape `\t`/`\r`.
- [ ] `M4-T2`: Official Gemini model ID verified in `src/lib/ai/config.ts`, `GEMINI_API_KEY` live-tested, and `m4-t2.test.mjs` passes.
- [ ] `M4-T3`: `ExportButton` forwards active `year`/`month`, and both components are mounted by `@frontend`.
- [ ] `M4-T4`: Route & CSV regression tests added and `100%` passing.
- [ ] `M4-T5`: `docs/presentation/4-slide-pitch.md` & `judge-questions.md` free of `VERIFY` placeholders (`12/12` checks green).
- [ ] `M4-T6`: Live demo rehearsed & `90s` backup video recorded (`6/6` checks green).

---

## 11. Blocked Template & Cut Order

**If blocked on dashboard mounting, post in team chat:**
> `@frontend I need: AssistantPanel and ExportButton mounted in the dashboard slots, with ExportButton passing active year/month. File: src/components/dashboard/DashboardShell.tsx. Why: lines 846-857 still render placeholder text. By hour: ASAP.`

**If time runs short:**
1. **Cut FIRST:** `M4-T7` (PDF export) immediately.
2. **Never cut:** Working CSV export (`M4-T1` `bbox` fix), AI numeric/evacuation guardrails (`M4-T2`), `docs/presentation/4-slide-pitch.md` with honest numbers, and the 90-second backup video (`M4-T6`).
