import { z } from "zod";

import { AI_MAX_QUESTION_LENGTH } from "./config";

const regionLevelSchema = z.enum(["country", "region", "province", "custom"]);
const metricSchema = z.enum(["harmonized", "raw"]);
const instrumentSchema = z.enum(["MODIS", "VIIRS", "ALL"]);
const anomalyLabelSchema = z.enum([
  "below_baseline",
  "near_baseline",
  "above_baseline",
  "unusually_high",
  "not_calculable",
]);

const harmonizationInfoSchema = z
  .object({
    method: z.string(),
    targetSensor: z.literal("VIIRS"),
    overlapYears: z.array(z.number().int()),
    factor: z.number().nullable(),
    factorScope: z.enum(["province", "national"]),
    correlation: z.number().nullable(),
    errorPercent: z.number().nullable(),
    estimatedYears: z.array(z.number().int()),
    notes: z.array(z.string()),
  })
  .strict();

export const analyticsSummarySchema = z
  .object({
    region: z
      .object({
        id: z.string(),
        name: z.string(),
        level: regionLevelSchema,
      })
      .strict(),
    period: z
      .object({
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
      })
      .strict(),
    metric: metricSchema,
    instrument: instrumentSchema,
    currentCount: z.number().nullable(),
    currentIsEstimated: z.boolean(),
    byInstrument: z
      .object({
        MODIS: z.number().nullable(),
        VIIRS: z.number().nullable(),
      })
      .strict(),
    baselineYears: z.array(z.number().int()),
    estimatedBaselineYears: z.array(z.number().int()),
    historicalMedian: z.number().nullable(),
    anomalyPercent: z.number().nullable(),
    label: anomalyLabelSchema,
    approximate: z.boolean(),
    notes: z.array(z.string()),
    dataCoverage: z
      .object({
        firstDate: z.string(),
        lastDate: z.string(),
      })
      .strict()
      .nullable(),
    harmonization: harmonizationInfoSchema.nullable(),
    lastUpdated: z.string().nullable(),
  })
  .strict();

export const aiBriefRequestSchema = z
  .object({
    summary: analyticsSummarySchema,
    question: z.string().trim().min(1).max(AI_MAX_QUESTION_LENGTH),
  })
  .strict();

export type AnalyticsSummaryForAi = z.infer<typeof analyticsSummarySchema>;
export type AiBriefRequestForAi = z.infer<typeof aiBriefRequestSchema>;
