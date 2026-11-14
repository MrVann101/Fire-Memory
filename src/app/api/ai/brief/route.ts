import { NextResponse } from "next/server";

import {
  AiConfigurationError,
  AiOutputValidationError,
  AiProviderError,
  AiRequestValidationError,
  createAiBrief,
  formatValidationError,
} from "@/lib/ai/brief";
import { AI_MAX_QUESTION_LENGTH } from "@/lib/ai/config";

const MAX_BODY_BYTES = 100_000;

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "INVALID_AI_REQUEST", message: "The request body could not be read." },
      { status: 400 },
    );
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "AI_REQUEST_TOO_LARGE", message: "The request body is too large." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "INVALID_AI_REQUEST", message: "The request body must be valid JSON." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await createAiBrief(body), { status: 200 });
  } catch (error) {
    if (error instanceof AiRequestValidationError) {
      return NextResponse.json(
        {
          error: error.code,
          message: formatValidationError(error),
          maxQuestionLength: AI_MAX_QUESTION_LENGTH,
        },
        { status: 400 },
      );
    }
    if (error instanceof AiConfigurationError) {
      return NextResponse.json(
        { error: error.code, message: "The AI service is temporarily unavailable." },
        { status: 503 },
      );
    }
    if (error instanceof AiOutputValidationError) {
      return NextResponse.json(
        { error: error.code, message: "The AI response could not be safely shown." },
        { status: 502 },
      );
    }
    if (error instanceof AiProviderError) {
      return NextResponse.json(
        { error: error.code, message: "The AI service did not return a usable response." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "AI_REQUEST_FAILED", message: "The AI request failed." },
      { status: 500 },
    );
  }
}
