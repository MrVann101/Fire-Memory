"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { AI_MAX_QUESTION_LENGTH } from "@/lib/ai/config";
import type { AnalyticsSummaryForAi } from "@/lib/ai/request";

interface AiBriefResponse {
  answer: string;
  disclaimer: string;
}

interface AiErrorResponse {
  message?: string;
}

interface AssistantPanelProps {
  summary: AnalyticsSummaryForAi | null;
}

const SUGGESTED_QUESTIONS = [
  "Explain this month's hotspot activity compared with previous years.",
  "How does the current count compare with the historical median?",
  "What limitations should I consider when interpreting this result?",
];

const DEFAULT_DISCLAIMER =
  "AI interpretation only. Satellite detections are not confirmed fires, forecasts, or emergency instructions. Verify important decisions with official sources.";

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

export function AssistantPanel({ summary }: AssistantPanelProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState(DEFAULT_DISCLAIMER);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => requestController.current?.abort();
  }, []);

  function chooseSuggestedQuestion(value: string) {
    setQuestion(value);
    setError(null);
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    if (!summary) {
      setError("Select a region and month before asking for a data explanation.");
      return;
    }

    if (trimmedQuestion.length === 0) {
      setError("Enter a question or choose one of the suggested questions.");
      return;
    }

    if (trimmedQuestion.length > AI_MAX_QUESTION_LENGTH) {
      setError(
        `Keep the question under ${AI_MAX_QUESTION_LENGTH} characters.`,
      );
      return;
    }

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
        body: JSON.stringify({ summary, question: trimmedQuestion }),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(body) ?? "The AI interpretation could not be loaded.",
        );
      }
      if (!isAiBriefResponse(body)) {
        throw new Error("The AI returned an invalid response.");
      }

      setAnswer(body.answer);
      setDisclaimer(body.disclaimer);
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        return;
      }
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The AI interpretation could not be loaded.",
      );
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setIsLoading(false);
      }
    }
  }

  return (
    <section
      aria-labelledby="assistant-panel-title"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Feature 04 · Gemini AI
        </p>
        <h2 id="assistant-panel-title" className="mt-1 text-xl font-semibold text-slate-950">
          Gemini AI assistant
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Get an explanation of the selected fire-activity data and historical
          comparison.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" aria-label="Suggested questions">
        {SUGGESTED_QUESTIONS.map((suggestedQuestion) => (
          <button
            key={suggestedQuestion}
            type="button"
            onClick={() => chooseSuggestedQuestion(suggestedQuestion)}
            disabled={!summary || isLoading}
            className="rounded-full border border-slate-300 px-3 py-2 text-left text-xs text-slate-700 transition hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          >
            {suggestedQuestion}
          </button>
        ))}
      </div>

      <form onSubmit={submitQuestion}>
        <label htmlFor="assistant-question" className="sr-only">
          Question for the AI interpretation
        </label>
        <textarea
          id="assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={AI_MAX_QUESTION_LENGTH}
          rows={3}
          placeholder="Ask a question about the selected region and period"
          className="w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-500"
          aria-describedby="assistant-question-help assistant-error"
          disabled={isLoading || !summary}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p id="assistant-question-help" className="text-xs text-slate-500">
            {question.length}/{AI_MAX_QUESTION_LENGTH} characters
          </p>
          <button
            type="submit"
            disabled={isLoading || !summary}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Interpreting..." : "Ask Gemini"}
          </button>
        </div>
      </form>

      {error ? (
        <p
          id="assistant-error"
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <div
        aria-live="polite"
        className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
      >
        <h3 className="text-sm font-semibold text-slate-900">
          Data explanation
        </h3>
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-600">
            Preparing an interpretation from the supplied analytics...
          </p>
        ) : answer ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {answer}
          </p>
        ) : !summary ? (
          <p className="mt-2 text-sm text-slate-600">
            Select a region and month to enable explanations grounded in the
            dashboard analytics.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Ask a question to receive a data-grounded interpretation.
          </p>
        )}
      </div>

      <p className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
        {disclaimer}
      </p>
    </section>
  );
}
