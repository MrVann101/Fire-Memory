import { GoogleGenAI } from "@google/genai";
import { ZodError } from "zod";

import {
  AI_MAX_OUTPUT_TOKENS,
  AI_REQUEST_TIMEOUT_MS,
  AI_TEMPERATURE,
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
  "CDRRMO Advisory AI interpretation only. Satellite detections are not confirmed fires, forecasts, or emergency instructions. Coordinate field verification and operational decisions through official CDRRMO, BFP, and LGU incident command channels.";

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
  const client = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      client.models.generateContent({
        model: GEMINI_MODEL,
        contents: buildBriefUserContent(request.summary, request.question),
        config: {
          systemInstruction: AI_SYSTEM_INSTRUCTION,
          temperature: AI_TEMPERATURE,
          maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
        },
      }),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new AiProviderError("The AI provider timed out.")),
          AI_REQUEST_TIMEOUT_MS,
        );
      }),
    ]);
    return response.text ?? "";
  } catch {
    throw new AiProviderError();
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
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

