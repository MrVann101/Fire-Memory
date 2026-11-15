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
  type SupportedLanguage,
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
  /\b(?:bakwit|magbakwit|mobakwit|likas|lumikas|paglikas)\b/i,
  /\bshould\s+(?:we|i|they)\s+(?:leave|flee|get out)\b/i,
  /\b(?:angay|dapat|kailangan)\s+(?:na\s+)?(?:ba\s+)?(?:kami|ta|sila)\s+(?:mobakwit|molayas|umalis|lumikas)\b/i,
  /\bwill\s+(?:it|the fire|fires?)\s+spread\b/i,
  /\b(?:mokatap|mokuyanap|kakalat|lalaganap)\b.*\b(?:sunog|kalayo|kayo|hotspot|fire)\b/i,
  /\b(?:predict|forecast|tagna|hula)\b.*\b(?:fire|spread|danger|risk|hotspot|sunog|kalayo|peligro|panganib)\b/i,
  /\bhow\s+dangerous\b/i,
  /\b(?:unsa\s+ka\s+peligro|gaano\s+kapanganib|delikado\s+na\s+ba)\b/i,
];

const UNSAFE_OUTPUT_PATTERNS = [
  /\b(?:you|people|residents|the public)\s+(?:should|must|need to)\s+(?:evacuate|leave|flee)\b/i,
  /\b(?:kamo|mga residente|katawhan|kayo|mga tao)\s+(?:dapat|kinahanglan|kailangan)\s+(?:mobakwit|lumikas|umalis)\b/i,
  /\b(?:will|is going to|is certain to|definitely)\b.{0,40}\bspread\b/i,
  /\b(?:mokatap|mokuyanap|kakalat|lalaganap)\b.{0,40}\b(?:sunog|kalayo|kayo)\b/i,
  /\b(?:predict|forecast)\b.{0,40}\b(?:spread|danger|fire|hotspot)\b/i,
];

const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;
const CONFIRMED_FIRE_PATTERN = /\bconfirmed fires?\b/gi;

const DISCLAIMER_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  en: "CDRRMO Advisory AI: Satellite hotspots are heat detections, not confirmed fires or forecasts. Coordinate field verification with BFP and Barangay DRRMCs.",
  ceb: "CDRRMO Advisory AI: Mga deteksyon sa init gikan sa satelayt lang ang mga hotspot ug dili kini kompirmadong sunog o panagna. Makig-coordinate sa BFP ug Barangay DRRMC para sa beripikasyon.",
  fil: "CDRRMO Advisory AI: Mga deteksyon ng init mula sa satelayt lamang ang mga hotspot at hindi kumpirmadong sunog o hula. Makipag-ugnayan sa BFP at Barangay DRRMC para sa beripikasyon.",
};

export function getAiDisclaimer(language: SupportedLanguage = "en"): string {
  return DISCLAIMER_BY_LANGUAGE[language] ?? DISCLAIMER_BY_LANGUAGE.en;
}

const UNSAFE_QUESTION_ANSWERS: Record<SupportedLanguage, string> = {
  en: "Computed values: I can interpret the supplied analytics for CDRRMO situational awareness, but I cannot provide evacuation or prediction advice.\n\nInterpretation: Please coordinate urgent life-safety, field verification, and operational response decisions through official CDRRMO, BFP, and LGU incident command channels.\n\nLimitations: This CDRRMO Advisory AI only explains supplied satellite-detection statistics, which are thermal anomalies and not confirmed fires.",
  ceb: "Computed values: Makatabang ko sa pagpasabot sa nahatag nga datos alang sa pagbantay sa CDRRMO, apan dili ko makahatag og mando sa pagbakwit o panagna sa sunog.\n\nInterpretation: Palihug makig-coordinate sa opisyal nga CDRRMO, BFP, ug LGU incident command alang sa kaluwasan sa katawhan, field verification, ug operasyon sa emerhensya.\n\nLimitations: Kini nga CDRRMO Advisory AI nagpasabot lang sa estatistika gikan sa satelayt, nga mga timailhan sa init ug dili kompirmadong sunog.",
  fil: "Computed values: Maipapaliwanag ko ang ibinigay na datos para sa pagbabantay ng CDRRMO, ngunit hindi ako makapagbibigay ng utos sa paglikas o hula sa pagkalat ng sunog.\n\nInterpretation: Mangyaring makipag-ugnayan sa opisyal na CDRRMO, BFP, at LGU incident command para sa kaligtasan ng publiko, field verification, at pagtugon sa emerhensya.\n\nLimitations: Ang CDRRMO Advisory AI na ito ay nagpapaliwanag lamang ng mga estatistika mula sa satelayt, na mga senyales ng init at hindi kumpirmadong sunog.",
};

function getUnsafeQuestionResponse(
  language: SupportedLanguage = "en",
): AiBriefResponseForAi {
  return {
    answer: UNSAFE_QUESTION_ANSWERS[language] ?? UNSAFE_QUESTION_ANSWERS.en,
    disclaimer: getAiDisclaimer(language),
  };
}

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

const MONTH_NAMES_BY_LANGUAGE: Record<SupportedLanguage, readonly string[]> = {
  en: [
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
  ],
  ceb: [
    "Enero",
    "Pebrero",
    "Marso",
    "Abril",
    "Mayo",
    "Hunyo",
    "Hulyo",
    "Agosto",
    "Setyembre",
    "Oktubre",
    "Nobyembre",
    "Disyembre",
  ],
  fil: [
    "Enero",
    "Pebrero",
    "Marso",
    "Abril",
    "Mayo",
    "Hunyo",
    "Hulyo",
    "Agosto",
    "Setyembre",
    "Oktubre",
    "Nobyembre",
    "Disyembre",
  ],
};

function getLocalizedMonthName(
  month: number,
  language: SupportedLanguage,
): string {
  const list = MONTH_NAMES_BY_LANGUAGE[language] ?? MONTH_NAMES_BY_LANGUAGE.en;
  return (
    list[month - 1] ??
    (language === "ceb"
      ? "gipiling buwan"
      : language === "fil"
        ? "napiling buwan"
        : "selected month")
  );
}

interface DeterministicCopy {
  countRecorded: (count: number, estimated: boolean) => string;
  countInProgress: string;
  medianVs: (monthName: string, median: number, baselineLen: number) => string;
  baselineOnly: (baselineLen: number) => string;
  anomalyVsNormal: (pct: number) => string;
  sensorsBoth: (viirs: number, modis: number) => string;
  sensorsViirsOnly: (viirs: number) => string;
  sensorsModisOnly: (modis: number) => string;
  guidanceBoth: string;
  guidanceViirsOnly: string;
  guidanceModisOnly: string;
  guidanceZero: string;
  guidanceFallback: string;
  postureUnusuallyHigh: (regionName: string, guidance: string) => string;
  postureAbove: (regionName: string, guidance: string) => string;
  postureNear: (regionName: string, guidance: string) => string;
  postureBelow: (regionName: string, guidance: string) => string;
  postureNotCalculable: (regionName: string, guidance: string) => string;
  sensorQuestionAnswer: (
    regionName: string,
    viirsCount: number | null,
    modisCount: number | null,
    guidance: string,
  ) => string;
  limitationsCaveats: (
    regionName: string,
    details: string[],
    guidance: string,
  ) => string;
  limCurrentNull: string;
  limCurrentEst: string;
  limBaselineEst: (estLen: number, baseLen: number) => string;
  limApprox: string;
  limCoverage: (firstDate: string, lastDate: string) => string;
  baselineQuestionAnswer: (
    regionName: string,
    monthName: string,
    year: number,
    summary: AnalyticsSummaryForAi,
    baseInterpretation: string,
  ) => string;
  watchlistQuestionAnswer: (regionName: string, guidance: string) => string;
  limitationCore: string;
  limitationInProgress: string;
  limitationApprox: string;
  safeFallbackComputed: (
    regionName: string,
    monthName: string,
    year: number,
  ) => string;
  safeFallbackInterpretation: (regionName: string) => string;
  safeFallbackLimitations: string;
}

const DETERMINISTIC_COPY: Record<SupportedLanguage, DeterministicCopy> = {
  en: {
    countRecorded: (count, estimated) =>
      `${count} hotspots recorded${estimated ? " (estimated)" : ""}`,
    countInProgress: "monthly archive count is still in progress",
    medianVs: (monthName, median, baselineLen) =>
      ` vs. a typical ${monthName} median of ${median} (${baselineLen}-year baseline)`,
    baselineOnly: (baselineLen) => ` (${baselineLen}-year baseline)`,
    anomalyVsNormal: (pct) => ` (${pct}% vs. normal)`,
    sensorsBoth: (viirs, modis) =>
      `Sensors: ${viirs} VIIRS (localized fine-scale) and ${modis} MODIS (wide-area) detections.`,
    sensorsViirsOnly: (viirs) => `Sensors: ${viirs} VIIRS detections recorded.`,
    sensorsModisOnly: (modis) => `Sensors: ${modis} MODIS detections recorded.`,
    guidanceBoth:
      "Both fine-scale VIIRS and wide-area MODIS detected heat sources—coordinate BFP and Barangay DRRMC ground verification across priority watchlist sectors to check both localized brush ignitions and persistent clusters.",
    guidanceViirsOnly:
      "Activity is detected by fine-scale VIIRS with no wide-area MODIS detections—direct Barangay DRRMCs and BFP units to verify localized small brush or agricultural heat sources in priority corridors.",
    guidanceModisOnly:
      "Wide-area MODIS detected sustained thermal activity—coordinate municipal BFP and Barangay DRRMC verification across the active watchlist corridor.",
    guidanceZero:
      "Both VIIRS and MODIS show zero active detections in this window—maintain routine CDRRMO watch and local BFP readiness across watchlist sectors.",
    guidanceFallback:
      "Check live map VIIRS and MODIS detections and coordinate verification with local BFP and Barangay DRRMCs.",
    postureUnusuallyHigh: (regionName, guidance) =>
      `Activity in ${regionName} is unusually high. ${guidance}`,
    postureAbove: (regionName, guidance) =>
      `Activity in ${regionName} is above normal. ${guidance}`,
    postureNear: (regionName, guidance) =>
      `Activity in ${regionName} is near normal seasonal levels. ${guidance}`,
    postureBelow: (regionName, guidance) =>
      `Activity in ${regionName} is below the typical monthly baseline. ${guidance}`,
    postureNotCalculable: (regionName, guidance) =>
      `Baseline comparison is unavailable for ${regionName}. ${guidance}`,
    sensorQuestionAnswer: (regionName, viirsCount, modisCount, guidance) => {
      const vText =
        viirsCount !== null
          ? `VIIRS recorded ${viirsCount} fine-scale localized detections`
          : "VIIRS count is unavailable";
      const mText =
        modisCount !== null
          ? `MODIS recorded ${modisCount} wider-area detections`
          : "MODIS count is unavailable";
      return `For ${regionName}, ${vText} and ${mText}. ${guidance}`;
    },
    limitationsCaveats: (regionName, details, guidance) =>
      details.length > 0
        ? `Key briefing caveats for ${regionName}: ${details.join("; ")}. Always verify satellite thermal anomalies with BFP and Barangay DRRMCs.`
        : `No special estimation flags apply to ${regionName}, though satellite detections still require BFP or barangay ground verification. ${guidance}`,
    limCurrentNull: "the current period archive count is still incomplete",
    limCurrentEst:
      "the current value uses a MODIS-converted estimate rather than direct VIIRS observation",
    limBaselineEst: (estLen, baseLen) =>
      `${estLen} of ${baseLen} baseline years are MODIS-harmonized estimates`,
    limApprox: "custom area bounds use grid-cell approximation",
    limCoverage: (firstDate, lastDate) =>
      `archive coverage runs from ${firstDate} to ${lastDate}`,
    baselineQuestionAnswer: (
      regionName,
      monthName,
      year,
      summary,
      baseInterpretation,
    ) => {
      const cmpText =
        summary.currentCount !== null && summary.historicalMedian !== null
          ? `${summary.currentCount} detections vs. a ${summary.baselineYears.length}-year historical median of ${summary.historicalMedian}${summary.anomalyPercent !== null ? ` (${summary.anomalyPercent}% difference)` : ""}`
          : `a ${summary.baselineYears.length}-year baseline median of ${summary.historicalMedian ?? "unavailable"}`;
      return `${regionName} shows ${cmpText} for ${monthName} ${year}. ${baseInterpretation}`;
    },
    watchlistQuestionAnswer: (regionName, guidance) =>
      `Open the Watchlist tab to inspect sector-level hotspot volume for ${regionName} and prioritize ground verification with BFP and Barangay DRRMCs. ${guidance}`,
    limitationCore:
      "Satellite hotspots indicate heat sources, not confirmed fires—verify on the ground with BFP or barangay responders.",
    limitationInProgress:
      "Current month archive summary is still in progress; check live map hotspots for active detections.",
    limitationApprox: "Custom area counts are grid-approximated.",
    safeFallbackComputed: (regionName, monthName, year) =>
      `${regionName} summary for ${monthName} ${year}.`,
    safeFallbackInterpretation: (regionName) =>
      `Monitor priority watchlist areas in ${regionName} and verify active hotspots with BFP and Barangay DRRMCs.`,
    safeFallbackLimitations:
      "Satellite hotspots are thermal anomalies and are not confirmed fires.",
  },
  ceb: {
    countRecorded: (count, estimated) =>
      `${count} ka hotspot ang natala${estimated ? " (gibanabana)" : ""}`,
    countInProgress: "ang buwanang ihap sa arkibo nagpadayon pa sa pagtipon",
    medianVs: (monthName, median, baselineLen) =>
      ` kon itandi sa kasarangang medyan sa ${monthName} nga ${median} (gikan sa ${baselineLen} ka tuig nga basehan)`,
    baselineOnly: (baselineLen) =>
      ` (gikan sa ${baselineLen} ka tuig nga basehan)`,
    anomalyVsNormal: (pct) => ` (${pct}% itandi sa normal)`,
    sensorsBoth: (viirs, modis) =>
      `Mga Sensor: ${viirs} ka deteksyon gikan sa VIIRS (detalyadong dapit) ug ${modis} gikan sa MODIS (lapad nga sakop).`,
    sensorsViirsOnly: (viirs) =>
      `Mga Sensor: ${viirs} ka deteksyon gikan sa VIIRS ang natala.`,
    sensorsModisOnly: (modis) =>
      `Mga Sensor: ${modis} ka deteksyon gikan sa MODIS ang natala.`,
    guidanceBoth:
      "Parehong nakakita og init ang detalyadong VIIRS ug lapad nga MODIS—makig-coordinate sa BFP ug Barangay DRRMC alang sa ground verification sa mga lugar nga naa sa watchlist aron masusi ang gagmayng sunog sa sagbot ug dugay nang init.",
    guidanceViirsOnly:
      "Nakakita og init ang detalyadong VIIRS bisan walay nakita ang MODIS—gimando ang pag-check sa Barangay DRRMC ug BFP sa gagmayng dapit sa sagbot o umahan sa mga prayoridad nga koridor.",
    guidanceModisOnly:
      "Ang lapad nga sensor sa MODIS nakatala og padayon nga init—makig-alayon sa lokal nga BFP ug Barangay DRRMC alang sa pagsusi sa mga aktibong sektor.",
    guidanceZero:
      "Walay aktibong deteksyon sa VIIRS ug MODIS niining panahona—ipadayon ang regular nga pag-monitor sa CDRRMO ug kahandaan sa lokal nga BFP.",
    guidanceFallback:
      "Tan-awa ang live nga mga punto sa VIIRS ug MODIS sa mapa ug ipakumpirma sa lokal nga BFP ug Barangay DRRMC.",
    postureUnusuallyHigh: (regionName, guidance) =>
      `Labihan ka taas ang ihap sa init sa ${regionName}. ${guidance}`,
    postureAbove: (regionName, guidance) =>
      `Labaw sa normal ang aktibidad sa ${regionName}. ${guidance}`,
    postureNear: (regionName, guidance) =>
      `Duol sa kasagarang lebel sa panahon ang aktibidad sa ${regionName}. ${guidance}`,
    postureBelow: (regionName, guidance) =>
      `Mas ubos sa kasagarang buwanang basehan ang aktibidad sa ${regionName}. ${guidance}`,
    postureNotCalculable: (regionName, guidance) =>
      `Walay saktong pagtandi sa kasaysayan alang sa ${regionName}. ${guidance}`,
    sensorQuestionAnswer: (regionName, viirsCount, modisCount, guidance) => {
      const vText =
        viirsCount !== null
          ? `Nakatala ang VIIRS og ${viirsCount} ka detalyadong deteksyon`
          : "walay magamit nga ihap sa VIIRS";
      const mText =
        modisCount !== null
          ? `ang MODIS nakatala og ${modisCount} ka lapad nga deteksyon`
          : "walay magamit nga ihap sa MODIS";
      return `Alang sa ${regionName}, ${vText} ug ${mText}. ${guidance}`;
    },
    limitationsCaveats: (regionName, details, guidance) =>
      details.length > 0
        ? `Mga importante nga limitasyon alang sa ${regionName}: ${details.join("; ")}. Siguraduhang ipakumpirma sa BFP ug Barangay DRRMC ang bisan unsang deteksyon sa satelayt.`
        : `Walay espesyal nga gibanabanang datos alang sa ${regionName}, apan gikinahanglan gihapon ang aktuwal nga pagsusi sa BFP o barangay. ${guidance}`,
    limCurrentNull: "kulang pa ang kompletong rekord niining buwana sa arkibo",
    limCurrentEst:
      "ang kasamtangang numero gibanabana gikan sa MODIS imbes direktang sukod sa VIIRS",
    limBaselineEst: (estLen, baseLen) =>
      `${estLen} sa ${baseLen} ka tuig nga basehan gibanabana gamit ang kalibrasyon sa MODIS`,
    limApprox: "ang gidrowing nga lugar gibanabana gamit ang grid",
    limCoverage: (firstDate, lastDate) =>
      `ang sakop sa arkibo nagdagan gikan sa ${firstDate} hangtod ${lastDate}`,
    baselineQuestionAnswer: (
      regionName,
      monthName,
      year,
      summary,
      baseInterpretation,
    ) => {
      const cmpText =
        summary.currentCount !== null && summary.historicalMedian !== null
          ? `${summary.currentCount} ka deteksyon itandi sa ${summary.baselineYears.length}-tuig nga kasarangang medyan nga ${summary.historicalMedian}${summary.anomalyPercent !== null ? ` (${summary.anomalyPercent}% nga kalainan)` : ""}`
          : `${summary.baselineYears.length}-tuig nga kasarangang medyan nga ${summary.historicalMedian ?? "walay datos"}`;
      return `Nagpakita ang ${regionName} og ${cmpText} para sa ${monthName} ${year}. ${baseInterpretation}`;
    },
    watchlistQuestionAnswer: (regionName, guidance) =>
      `Ablihi ang Watchlist tab aron makita ang ihap matag sektor sa ${regionName} ug unaha ang pagpasusi sa field uban sa BFP ug Barangay DRRMC. ${guidance}`,
    limitationCore:
      "Mga timailhan lang sa init gikan sa satelayt ang mga hotspot ug dili kini kompirmadong sunog—ipakumpirma sa BFP o mga responder sa barangay.",
    limitationInProgress:
      "Nagpadayon pa ang pagtipon sa summary niining buwana; susiha ang live map alang sa bag-ong deteksyon.",
    limitationApprox: "Ang ihap alang sa gidrowing nga lugar gibanabana sa grid.",
    safeFallbackComputed: (regionName, monthName, year) =>
      `Katingbanan sa ${regionName} alang sa ${monthName} ${year}.`,
    safeFallbackInterpretation: (regionName) =>
      `Bantayi ang mga lugar sa watchlist sa ${regionName} ug ipakumpirma ang mga aktibong hotspot sa BFP ug Barangay DRRMC.`,
    safeFallbackLimitations:
      "Ang mga hotspot sa satelayt mga timailhan sa init ug dili kompirmadong sunog.",
  },
  fil: {
    countRecorded: (count, estimated) =>
      `${count} na hotspot ang naitala${estimated ? " (tinataya)" : ""}`,
    countInProgress: "patuloy pa ang pagtitipon ng buwanang ulat sa arkibo",
    medianVs: (monthName, median, baselineLen) =>
      ` kumpara sa karaniwang medyan ng ${monthName} na ${median} (mula sa ${baselineLen} taong batayan)`,
    baselineOnly: (baselineLen) => ` (mula sa ${baselineLen} taong batayan)`,
    anomalyVsNormal: (pct) => ` (${pct}% kumpara sa normal)`,
    sensorsBoth: (viirs, modis) =>
      `Mga Sensor: ${viirs} na deteksyon sa VIIRS (detalyadong sukat) at ${modis} sa MODIS (malawak na sakop).`,
    sensorsViirsOnly: (viirs) =>
      `Mga Sensor: ${viirs} na deteksyon mula sa VIIRS ang naitala.`,
    sensorsModisOnly: (modis) =>
      `Mga Sensor: ${modis} na deteksyon mula sa MODIS ang naitala.`,
    guidanceBoth:
      "Parehong nakakita ng init ang detalyadong VIIRS at malawak na MODIS—makipag-ugnayan sa BFP at Barangay DRRMC para sa ground verification sa mga lugar sa watchlist upang suriin ang mga maliliit na sunog sa damuhan at patuloy na kumpol ng init.",
    guidanceViirsOnly:
      "May naitalang init sa detalyadong VIIRS kahit walang nakuha ang MODIS—atasin ang Barangay DRRMC at BFP na suriin ang maliliit na pinagmulan ng init sa damuhan o sakahan sa mga prayoridad na sektor.",
    guidanceModisOnly:
      "Nagtala ang malawak na sensor ng MODIS ng patuloy na aktibidad ng init—makipag-ugnayan sa lokal na BFP at Barangay DRRMC upang beripikahin ang aktibong koridor.",
    guidanceZero:
      "Walang aktibong deteksyon mula sa VIIRS at MODIS sa panahong ito—panatilihin ang regular na pagbabantay ng CDRRMO at kahandaan ng lokal na BFP.",
    guidanceFallback:
      "Suriin ang live na mga punto ng VIIRS at MODIS sa mapa at ipaberipika sa lokal na BFP at Barangay DRRMC.",
    postureUnusuallyHigh: (regionName, guidance) =>
      `Lubhang mataas ang aktibidad sa ${regionName}. ${guidance}`,
    postureAbove: (regionName, guidance) =>
      `Mas mataas sa normal ang aktibidad sa ${regionName}. ${guidance}`,
    postureNear: (regionName, guidance) =>
      `Malapit sa karaniwang lebel ng panahon ang aktibidad sa ${regionName}. ${guidance}`,
    postureBelow: (regionName, guidance) =>
      `Mas mababa sa karaniwang buwanang batayan ang aktibidad sa ${regionName}. ${guidance}`,
    postureNotCalculable: (regionName, guidance) =>
      `Walang sapat na paghahambing sa kasaysayan para sa ${regionName}. ${guidance}`,
    sensorQuestionAnswer: (regionName, viirsCount, modisCount, guidance) => {
      const vText =
        viirsCount !== null
          ? `nagtala ang VIIRS ng ${viirsCount} na detalyadong deteksyon`
          : "walang magagamit na bilang ang VIIRS";
      const mText =
        modisCount !== null
          ? `nagtala ang MODIS ng ${modisCount} na malawak na deteksyon`
          : "walang magagamit na bilang ang MODIS";
      return `Para sa ${regionName}, ${vText} at ${mText}. ${guidance}`;
    },
    limitationsCaveats: (regionName, details, guidance) =>
      details.length > 0
        ? `Mga mahahalagang limitasyon para sa ${regionName}: ${details.join("; ")}. Palaging ipaberipika sa BFP at Barangay DRRMC ang anumang deteksyon mula sa satelayt.`
        : `Walang espesyal na tinatayang datos para sa ${regionName}, ngunit kailangan pa rin ng beripikasyon sa lupa mula sa BFP o barangay. ${guidance}`,
    limCurrentNull: "hindi pa kumpleto ang bilang sa arkibo para sa buwang ito",
    limCurrentEst:
      "ang kasalukuyang bilang ay tinataya mula sa MODIS sa halip na direktang sukat ng VIIRS",
    limBaselineEst: (estLen, baseLen) =>
      `${estLen} sa ${baseLen} taon ng batayan ay tinataya gamit ang kalibrasyon ng MODIS`,
    limApprox: "ang ginuhit na lugar ay tinataya lamang sa grid",
    limCoverage: (firstDate, lastDate) =>
      `ang saklaw ng arkibo ay mula ${firstDate} hanggang ${lastDate}`,
    baselineQuestionAnswer: (
      regionName,
      monthName,
      year,
      summary,
      baseInterpretation,
    ) => {
      const cmpText =
        summary.currentCount !== null && summary.historicalMedian !== null
          ? `${summary.currentCount} na deteksyon kumpara sa ${summary.baselineYears.length}-taong medyan na ${summary.historicalMedian}${summary.anomalyPercent !== null ? ` (${summary.anomalyPercent}% na pagkakaiba)` : ""}`
          : `${summary.baselineYears.length}-taong batayang medyan na ${summary.historicalMedian ?? "walang datos"}`;
      return `Nagpapakita ang ${regionName} ng ${cmpText} para sa ${monthName} ${year}. ${baseInterpretation}`;
    },
    watchlistQuestionAnswer: (regionName, guidance) =>
      `Buksan ang Watchlist tab upang makita ang bilang sa bawat sektor ng ${regionName} at unahin ang beripikasyon kasama ang BFP at Barangay DRRMC. ${guidance}`,
    limitationCore:
      "Mga senyales lamang ng init mula sa satelayt ang mga hotspot at hindi kumpirmadong sunog—ipaberipika sa BFP o mga responder ng barangay.",
    limitationInProgress:
      "Patuloy pang pinoproseso ang buod para sa buwang ito; tingnan ang live map para sa mga aktibong deteksyon.",
    limitationApprox: "Ang mga bilang para sa ginuhit na lugar ay tinataya sa grid.",
    safeFallbackComputed: (regionName, monthName, year) =>
      `Buod ng ${regionName} para sa ${monthName} ${year}.`,
    safeFallbackInterpretation: (regionName) =>
      `Bantayan ang mga lugar sa watchlist sa ${regionName} at ipaberipika ang mga aktibong hotspot sa BFP at Barangay DRRMC.`,
    safeFallbackLimitations:
      "Ang mga hotspot sa satelayt ay mga senyales ng init at hindi kumpirmadong sunog.",
  },
};

export function buildDeterministicCdrrmoAdvisory(
  summary: AnalyticsSummaryForAi,
  question?: string,
  language: SupportedLanguage = "en",
): string {
  const copy = DETERMINISTIC_COPY[language] ?? DETERMINISTIC_COPY.en;
  const monthName = getLocalizedMonthName(summary.period.month, language);
  const computedParts: string[] = [];

  const countClause =
    summary.currentCount !== null
      ? copy.countRecorded(summary.currentCount, summary.currentIsEstimated)
      : copy.countInProgress;

  const medianClause =
    summary.historicalMedian !== null
      ? copy.medianVs(
          monthName,
          summary.historicalMedian,
          summary.baselineYears.length,
        )
      : copy.baselineOnly(summary.baselineYears.length);

  const anomalyClause =
    summary.anomalyPercent !== null
      ? copy.anomalyVsNormal(summary.anomalyPercent)
      : "";

  computedParts.push(
    `${summary.region.name} (${monthName} ${summary.period.year}): ${countClause}${medianClause}${anomalyClause}.`,
  );

  const viirsCount = summary.byInstrument.VIIRS;
  const modisCount = summary.byInstrument.MODIS;

  if (viirsCount !== null && modisCount !== null) {
    computedParts.push(copy.sensorsBoth(viirsCount, modisCount));
  } else if (viirsCount !== null) {
    computedParts.push(copy.sensorsViirsOnly(viirsCount));
  } else if (modisCount !== null) {
    computedParts.push(copy.sensorsModisOnly(modisCount));
  }

  const hasViirs = viirsCount !== null && viirsCount > 0;
  const hasModis = modisCount !== null && modisCount > 0;

  let sensorGuidance: string;
  if (hasViirs && hasModis) {
    sensorGuidance = copy.guidanceBoth;
  } else if (hasViirs) {
    sensorGuidance = copy.guidanceViirsOnly;
  } else if (hasModis) {
    sensorGuidance = copy.guidanceModisOnly;
  } else if (viirsCount === 0 && modisCount === 0) {
    sensorGuidance = copy.guidanceZero;
  } else {
    sensorGuidance = copy.guidanceFallback;
  }

  let baseInterpretation: string;
  switch (summary.label) {
    case "unusually_high":
      baseInterpretation = copy.postureUnusuallyHigh(
        summary.region.name,
        sensorGuidance,
      );
      break;
    case "above_baseline":
      baseInterpretation = copy.postureAbove(
        summary.region.name,
        sensorGuidance,
      );
      break;
    case "near_baseline":
      baseInterpretation = copy.postureNear(
        summary.region.name,
        sensorGuidance,
      );
      break;
    case "below_baseline":
      baseInterpretation = copy.postureBelow(
        summary.region.name,
        sensorGuidance,
      );
      break;
    case "not_calculable":
      baseInterpretation = copy.postureNotCalculable(
        summary.region.name,
        sensorGuidance,
      );
      break;
  }

  const normalizedQuestion = question?.trim() ?? "";
  let interpretation = baseInterpretation;

  if (
    /\b(?:viirs|modis|sensor|satellite|satelayt|instrument)\b/i.test(
      normalizedQuestion,
    )
  ) {
    interpretation = copy.sensorQuestionAnswer(
      summary.region.name,
      viirsCount,
      modisCount,
      sensorGuidance,
    );
  } else if (
    /\b(?:limit|limitasyon|incomplet|cover|sakop|missing|kulang|estimat|banabana|taya|error|sayop|harmoniz|reliab|caveat|archive|arkibo|null|briefing|ulat)\b/i.test(
      normalizedQuestion,
    )
  ) {
    const limDetails: string[] = [];
    if (summary.currentCount === null) {
      limDetails.push(copy.limCurrentNull);
    }
    if (summary.currentIsEstimated) {
      limDetails.push(copy.limCurrentEst);
    }
    if (summary.estimatedBaselineYears.length > 0) {
      limDetails.push(
        copy.limBaselineEst(
          summary.estimatedBaselineYears.length,
          summary.baselineYears.length,
        ),
      );
    }
    if (summary.approximate) {
      limDetails.push(copy.limApprox);
    }
    if (summary.dataCoverage) {
      limDetails.push(
        copy.limCoverage(
          summary.dataCoverage.firstDate,
          summary.dataCoverage.lastDate,
        ),
      );
    }
    interpretation = copy.limitationsCaveats(
      summary.region.name,
      limDetails,
      sensorGuidance,
    );
  } else if (
    /\b(?:median|medyan|baseline|basehan|batayan|normal|anomal|compar|tandi|hambing|histori|kasaysayan|why|ngano|bakit|high|taas|low|ubos|baba|trend|differ|ihap|bilang)\b/i.test(
      normalizedQuestion,
    )
  ) {
    interpretation = copy.baselineQuestionAnswer(
      summary.region.name,
      monthName,
      summary.period.year,
      summary,
      baseInterpretation,
    );
  } else if (
    /\b(?:where|asa|saan|place|lugar|area|barangay|munici|corridor|koridor|watch|bantay|monitor|bfp|action|aksyon|lihok|focus|tutok|check|verify|susi|beripika)\b/i.test(
      normalizedQuestion,
    )
  ) {
    interpretation = copy.watchlistQuestionAnswer(
      summary.region.name,
      sensorGuidance,
    );
  }

  const limitationParts: string[] = [copy.limitationCore];

  if (summary.currentCount === null) {
    limitationParts.push(copy.limitationInProgress);
  } else if (summary.approximate) {
    limitationParts.push(copy.limitationApprox);
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
    `Computed values: ${copy.safeFallbackComputed(summary.region.name, monthName, summary.period.year)}`,
    `Interpretation: ${copy.safeFallbackInterpretation(summary.region.name)}`,
    `Limitations: ${copy.safeFallbackLimitations}`,
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
  const language: SupportedLanguage = request.language ?? "en";
  const client = new GoogleGenAI({ apiKey });
  const contents = buildBriefUserContent(
    request.summary,
    request.question,
    language,
  );
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

  return buildDeterministicCdrrmoAdvisory(
    request.summary,
    request.question,
    language,
  );
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

  const language: SupportedLanguage = parsed.data.language ?? "en";

  if (hasUnsafeQuestion(parsed.data.question)) {
    return getUnsafeQuestionResponse(language);
  }

  const answer = await generateText(parsed.data);
  const validation = validateBriefOutput(answer, parsed.data.summary);
  if (!validation.valid) {
    throw new AiOutputValidationError(validation.reason);
  }

  return {
    answer: answer.trim(),
    disclaimer: getAiDisclaimer(language),
  };
}

export function formatValidationError(error: AiRequestValidationError): string {
  return new ZodError(error.issues as never).message;
}

