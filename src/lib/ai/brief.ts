import { GoogleGenAI } from "@google/genai";
import { ZodError } from "zod";

import {
  AI_MAX_OUTPUT_TOKENS,
  AI_REQUEST_TIMEOUT_MS,
  AI_TEMPERATURE,
  GEMINI_FALLBACK_MODELS,
  GEMINI_MODEL,
} from "./config";
import {
  aiBriefRequestSchema,
  type AiBriefRequestForAi,
  type AnalyticsSummaryForAi,
} from "./request";
import { AI_SYSTEM_INSTRUCTION, buildBriefUserContent } from "./prompt";

export interface AiBriefResponseForAi {
  answer: string;
  disclaimer: string;
}

export class AiRequestValidationError extends Error {
  readonly code = "INVALID_AI_REQUEST";
  readonly issues: unknown;

  constructor(issues: unknown) {
    super("The AI request does not match the required analytics shape.");
    this.issues = issues;
  }
}

export class AiConfigurationError extends Error {
  readonly code = "AI_NOT_CONFIGURED";

  constructor() {
    super("The AI service is not configured.");
  }
}

export class AiProviderError extends Error {
  readonly code = "AI_PROVIDER_ERROR";

  constructor(message = "The AI provider did not return a usable response.") {
    super(message);
  }
}

export class AiOutputValidationError extends Error {
  readonly code = "AI_OUTPUT_REJECTED";
  readonly reason: string;

  constructor(reason: string) {
    super("The AI response failed the safety and grounding checks.");
    this.reason = reason;
  }
}

const UNSAFE_QUESTION_PATTERNS = [
  /\bevacuat(?:e|ion|ing)\b/i,
  /\bshould\s+(?:we|i|they)\s+(?:leave|flee|get out)\b/i,
  /\bwill\s+(?:it|the fire|fires?)\s+spread\b/i,
  /\b(?:predict|forecast)\b.*\b(?:fire|spread|danger|risk|hotspot)\b/i,
  /\bhow\s+dangerous\b/i,
];

const UNSAFE_OUTPUT_PATTERNS = [
  /\b(?:you|people|residents|the public)\s+(?:should|must|need to)\s+(?:evacuate|leave|flee)\b/i,
  /\b(?:will|is going to|is certain to|definitely)\b.{0,40}\bspread\b/i,
  /\b(?:predict|forecast)\b.{0,40}\b(?:spread|danger|fire|hotspot)\b/i,
];

const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;
const CONFIRMED_FIRE_PATTERN = /\bconfirmed fires?\b/gi;

const DISCLAIMER =
  "CDRRMO Advisory AI: Satellite hotspots are heat detections, not confirmed fires or forecasts. Coordinate field verification with BFP and Barangay DRRMCs.";

const UNSAFE_QUESTION_RESPONSE: AiBriefResponseForAi = {
  answer:
    "Computed values: I can interpret the supplied analytics for CDRRMO situational awareness, but I cannot provide evacuation or prediction advice.\n\nInterpretation: Please coordinate urgent life-safety, field verification, and operational response decisions through official CDRRMO, BFP, and LGU incident command channels.\n\nLimitations: This CDRRMO Advisory AI only explains supplied satellite-detection statistics, which are thermal anomalies and not confirmed fires.",
  disclaimer: DISCLAIMER,
};

function extractNumbers(value: string): Set<string> {
  return new Set(
    (value.match(NUMBER_PATTERN) ?? []).map((number) =>
      Number(number).toString(),
    ),
  );
}

function getAllowedNumbers(summary: AnalyticsSummaryForAi): Set<string> {
  const allowedNumbers = extractNumbers(JSON.stringify(summary));
  const derivedCounts = [
    summary.baselineYears.length,
    summary.estimatedBaselineYears.length,
    summary.harmonization?.overlapYears.length,
    summary.harmonization?.estimatedYears.length,
    summary.notes.length,
    summary.harmonization?.notes.length,
  ];

  for (const count of derivedCounts) {
    if (count !== undefined) {
      allowedNumbers.add(count.toString());
    }
  }

  return allowedNumbers;
}

function containsUnsupportedConfirmedFireClaim(answer: string): boolean {
  for (const match of answer.matchAll(CONFIRMED_FIRE_PATTERN)) {
    const precedingText = answer.slice(Math.max(0, match.index! - 12), match.index);
    if (!/\bnot\b/i.test(precedingText)) {
      return true;
    }
  }
  return false;
}

function hasUnsafeQuestion(question: string): boolean {
  return UNSAFE_QUESTION_PATTERNS.some((pattern) => pattern.test(question));
}

function hasUnsafeOutput(answer: string): boolean {
  return (
    UNSAFE_OUTPUT_PATTERNS.some((pattern) => pattern.test(answer)) ||
    containsUnsupportedConfirmedFireClaim(answer)
  );
}

export function validateBriefOutput(
  answer: string,
  summary: AnalyticsSummaryForAi,
): { valid: true } | { valid: false; reason: string } {
  const trimmedAnswer = answer.trim();
  if (trimmedAnswer.length === 0) {
    return { valid: false, reason: "The provider returned an empty answer." };
  }
  if (trimmedAnswer.length > 4_000) {
    return { valid: false, reason: "The provider answer exceeded the length cap." };
  }
  if (
    !/Computed values:/i.test(trimmedAnswer) ||
    !/Interpretation:/i.test(trimmedAnswer) ||
    !/Limitations:/i.test(trimmedAnswer)
  ) {
    return { valid: false, reason: "The provider omitted a required section." };
  }
  if (hasUnsafeOutput(trimmedAnswer)) {
    return { valid: false, reason: "The provider made an unsafe claim." };
  }

  const allowedNumbers = getAllowedNumbers(summary);
  const responseNumbers = extractNumbers(trimmedAnswer);
  const inventedNumber = [...responseNumbers].find(
    (number) => !allowedNumbers.has(number),
  );
  if (inventedNumber) {
    return {
      valid: false,
      reason: `The provider introduced unsupported number ${inventedNumber}.`,
    };
  }

  return { valid: true };
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function buildDeterministicCdrrmoAdvisory(
  summary: AnalyticsSummaryForAi,
  question?: string,
): string {
  const monthName = MONTH_NAMES[summary.period.month - 1] ?? "selected month";
  const computedParts: string[] = [];

  const countClause =
    summary.currentCount !== null
      ? `${summary.currentCount} hotspots recorded${summary.currentIsEstimated ? " (estimated)" : ""}`
      : "monthly archive count is still in progress";

  const medianClause =
    summary.historicalMedian !== null
      ? ` vs. a typical ${monthName} median of ${summary.historicalMedian} (${summary.baselineYears.length}-year baseline)`
      : ` (${summary.baselineYears.length}-year baseline)`;

  const anomalyClause =
    summary.anomalyPercent !== null
      ? ` (${summary.anomalyPercent}% vs. normal)`
      : "";

  computedParts.push(
    `${summary.region.name} (${monthName} ${summary.period.year}): ${countClause}${medianClause}${anomalyClause}.`,
  );

  const viirsCount = summary.byInstrument.VIIRS;
  const modisCount = summary.byInstrument.MODIS;

  if (viirsCount !== null && modisCount !== null) {
    computedParts.push(
      `Sensors: ${viirsCount} VIIRS (localized fine-scale) and ${modisCount} MODIS (wide-area) detections.`,
    );
  } else if (viirsCount !== null) {
    computedParts.push(`Sensors: ${viirsCount} VIIRS detections recorded.`);
  } else if (modisCount !== null) {
    computedParts.push(`Sensors: ${modisCount} MODIS detections recorded.`);
  }

  const hasViirs = viirsCount !== null && viirsCount > 0;
  const hasModis = modisCount !== null && modisCount > 0;

  let sensorGuidance: string;
  if (hasViirs && hasModis) {
    sensorGuidance =
      "Both fine-scale VIIRS and wide-area MODIS detected heat sources—coordinate BFP and Barangay DRRMC ground verification across priority watchlist sectors to check both localized brush ignitions and persistent clusters.";
  } else if (hasViirs) {
    sensorGuidance =
      "Activity is detected by fine-scale VIIRS with no wide-area MODIS detections—direct Barangay DRRMCs and BFP units to verify localized small brush or agricultural heat sources in priority corridors.";
  } else if (hasModis) {
    sensorGuidance =
      "Wide-area MODIS detected sustained thermal activity—coordinate municipal BFP and Barangay DRRMC verification across the active watchlist corridor.";
  } else if (viirsCount === 0 && modisCount === 0) {
    sensorGuidance =
      "Both VIIRS and MODIS show zero active detections in this window—maintain routine CDRRMO watch and local BFP readiness across watchlist sectors.";
  } else {
    sensorGuidance =
      "Check live map VIIRS and MODIS detections and coordinate verification with local BFP and Barangay DRRMCs.";
  }

  let baseInterpretation: string;
  switch (summary.label) {
    case "unusually_high":
      baseInterpretation = `Activity in ${summary.region.name} is unusually high. ${sensorGuidance}`;
      break;
    case "above_baseline":
      baseInterpretation = `Activity in ${summary.region.name} is above normal. ${sensorGuidance}`;
      break;
    case "near_baseline":
      baseInterpretation = `Activity in ${summary.region.name} is near normal seasonal levels. ${sensorGuidance}`;
      break;
    case "below_baseline":
      baseInterpretation = `Activity in ${summary.region.name} is below the typical monthly baseline. ${sensorGuidance}`;
      break;
    case "not_calculable":
      baseInterpretation = `Baseline comparison is unavailable for ${summary.region.name}. ${sensorGuidance}`;
      break;
  }

  const normalizedQuestion = question?.trim() ?? "";
  let interpretation = baseInterpretation;

  if (/\b(?:viirs|modis|sensor|satellite|instrument)\b/i.test(normalizedQuestion)) {
    const vText =
      viirsCount !== null
        ? `VIIRS recorded ${viirsCount} fine-scale localized detections`
        : "VIIRS count is unavailable";
    const mText =
      modisCount !== null
        ? `MODIS recorded ${modisCount} wider-area detections`
        : "MODIS count is unavailable";
    interpretation = `For ${summary.region.name}, ${vText} and ${mText}. ${sensorGuidance}`;
  } else if (
    /\b(?:limit|incomplet|cover|missing|estimat|error|harmoniz|reliab|caveat|archive|null|briefing)\b/i.test(
      normalizedQuestion,
    )
  ) {
    const limDetails: string[] = [];
    if (summary.currentCount === null) {
      limDetails.push("the current period archive count is still incomplete");
    }
    if (summary.currentIsEstimated) {
      limDetails.push("the current value uses a MODIS-converted estimate rather than direct VIIRS observation");
    }
    if (summary.estimatedBaselineYears.length > 0) {
      limDetails.push(
        `${summary.estimatedBaselineYears.length} of ${summary.baselineYears.length} baseline years are MODIS-harmonized estimates`,
      );
    }
    if (summary.approximate) {
      limDetails.push("custom area bounds use grid-cell approximation");
    }
    if (summary.dataCoverage) {
      limDetails.push(
        `archive coverage runs from ${summary.dataCoverage.firstDate} to ${summary.dataCoverage.lastDate}`,
      );
    }
    interpretation =
      limDetails.length > 0
        ? `Key briefing caveats for ${summary.region.name}: ${limDetails.join("; ")}. Always verify satellite thermal anomalies with BFP and Barangay DRRMCs.`
        : `No special estimation flags apply to ${summary.region.name}, though satellite detections still require BFP or barangay ground verification. ${sensorGuidance}`;
  } else if (
    /\b(?:median|baseline|normal|anomal|compar|histori|why|high|low|trend|differ)\b/i.test(
      normalizedQuestion,
    )
  ) {
    const cmpText =
      summary.currentCount !== null && summary.historicalMedian !== null
        ? `${summary.currentCount} detections vs. a ${summary.baselineYears.length}-year historical median of ${summary.historicalMedian}${summary.anomalyPercent !== null ? ` (${summary.anomalyPercent}% difference)` : ""}`
        : `a ${summary.baselineYears.length}-year baseline median of ${summary.historicalMedian ?? "unavailable"}`;
    interpretation = `${summary.region.name} shows ${cmpText} for ${monthName} ${summary.period.year}. ${baseInterpretation}`;
  } else if (
    /\b(?:where|place|area|barangay|munici|corridor|watch|monitor|bfp|action|focus|check|verify)\b/i.test(
      normalizedQuestion,
    )
  ) {
    interpretation = `Open the Watchlist tab to inspect sector-level hotspot volume for ${summary.region.name} and prioritize ground verification with BFP and Barangay DRRMCs. ${sensorGuidance}`;
  }

  const limitationParts: string[] = [
    "Satellite hotspots indicate heat sources, not confirmed fires—verify on the ground with BFP or barangay responders.",
  ];

  if (summary.currentCount === null) {
    limitationParts.push(
      "Current month archive summary is still in progress; check live map hotspots for active detections.",
    );
  } else if (summary.approximate) {
    limitationParts.push("Custom area counts are grid-approximated.");
  }

  const advisory = [
    `Computed values: ${computedParts.join(" ")}`,
    `Interpretation: ${interpretation}`,
    `Limitations: ${limitationParts.join(" ")}`,
  ].join("\n\n");

  if (validateBriefOutput(advisory, summary).valid) {
    return advisory;
  }

  return [
    `Computed values: ${summary.region.name} summary for ${monthName} ${summary.period.year}.`,
    `Interpretation: Monitor priority watchlist areas in ${summary.region.name} and verify active hotspots with BFP and Barangay DRRMCs.`,
    "Limitations: Satellite hotspots are thermal anomalies and are not confirmed fires.",
  ].join("\n\n");
}

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiConfigurationError();
  }
  return apiKey;
}

async function generateGeminiText(
  request: AiBriefRequestForAi,
): Promise<string> {
  const apiKey = getGeminiApiKey();
  const client = new GoogleGenAI({ apiKey });
  const contents = buildBriefUserContent(request.summary, request.question);
  const modelsToTry = GEMINI_FALLBACK_MODELS.includes(
    GEMINI_MODEL as (typeof GEMINI_FALLBACK_MODELS)[number],
  )
    ? GEMINI_FALLBACK_MODELS
    : [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS];

  for (const model of modelsToTry) {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: AI_SYSTEM_INSTRUCTION,
            temperature: AI_TEMPERATURE,
            maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
            ...(model.startsWith("gemini-2.5")
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
          },
        }),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new AiProviderError("The AI provider timed out.")),
            AI_REQUEST_TIMEOUT_MS,
          );
        }),
      ]);
      const text = response.text?.trim() ?? "";
      if (text && validateBriefOutput(text, request.summary).valid) {
        return text;
      }
    } catch {
      // Try next fallback model or fall back to deterministic CDRRMO advisory
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  return buildDeterministicCdrrmoAdvisory(request.summary, request.question);
}

export type AiTextGenerator = (
  request: AiBriefRequestForAi,
) => Promise<string>;

export async function createAiBrief(
  input: unknown,
  generateText: AiTextGenerator = generateGeminiText,
): Promise<AiBriefResponseForAi> {
  const parsed = aiBriefRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new AiRequestValidationError(parsed.error.issues);
  }

  if (hasUnsafeQuestion(parsed.data.question)) {
    return UNSAFE_QUESTION_RESPONSE;
  }

  const answer = await generateText(parsed.data);
  const validation = validateBriefOutput(answer, parsed.data.summary);
  if (!validation.valid) {
    throw new AiOutputValidationError(validation.reason);
  }

  return {
    answer: answer.trim(),
    disclaimer: DISCLAIMER,
  };
}

export function formatValidationError(error: AiRequestValidationError): string {
  return new ZodError(error.issues as never).message;
}

