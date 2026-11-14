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
      className="assistant-panel"
    >
      <div className="assistant-header">
        <p className="assistant-eyebrow">
          Feature 04 · Gemini AI
        </p>
        <h2 id="assistant-panel-title" className="assistant-title">
          Gemini AI assistant
        </h2>
        <p className="assistant-intro">
          Get an explanation of the selected fire-activity data and historical
          comparison.
        </p>
      </div>

      <div className="assistant-suggestions" aria-label="Suggested questions">
        {SUGGESTED_QUESTIONS.map((suggestedQuestion) => (
          <button
            key={suggestedQuestion}
            type="button"
            onClick={() => chooseSuggestedQuestion(suggestedQuestion)}
            disabled={!summary || isLoading}
            className="assistant-suggestion"
          >
            {suggestedQuestion}
          </button>
        ))}
      </div>

      <form className="assistant-form" onSubmit={submitQuestion}>
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
          className="assistant-question"
          aria-describedby="assistant-question-help assistant-error"
          disabled={isLoading || !summary}
        />
        <div className="assistant-form-footer">
          <p id="assistant-question-help" className="assistant-input-help">
            {question.length}/{AI_MAX_QUESTION_LENGTH} characters
          </p>
          <button
            type="submit"
            disabled={isLoading || !summary}
            className="assistant-submit"
          >
            {isLoading ? "Interpreting..." : "Ask Gemini"}
          </button>
        </div>
      </form>

      {error ? (
        <p
          id="assistant-error"
          role="alert"
          className="assistant-error"
        >
          {error}
        </p>
      ) : null}

      <div
        aria-live="polite"
        className="assistant-answer"
      >
        <h3 className="assistant-answer-title">Data explanation</h3>
        {isLoading ? (
          <p className="assistant-answer-copy">
            Preparing an interpretation from the supplied analytics...
          </p>
        ) : answer ? (
          <p className="assistant-answer-copy assistant-answer-result">
            {answer}
          </p>
        ) : !summary ? (
          <p className="assistant-answer-copy">
            Select a region and month to enable explanations grounded in the
            dashboard analytics.
          </p>
        ) : (
          <p className="assistant-answer-copy">
            Ask a question to receive a data-grounded interpretation.
          </p>
        )}
      </div>

      <p className="assistant-disclaimer">
        {disclaimer}
      </p>
    </section>
  );
}
