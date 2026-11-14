export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
] as const;

export const AI_MAX_QUESTION_LENGTH = 1_000;
export const AI_MAX_OUTPUT_TOKENS = 900;
export const AI_TEMPERATURE = 0.1;
export const AI_REQUEST_TIMEOUT_MS = 12_000;
