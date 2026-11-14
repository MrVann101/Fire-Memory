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
  onClose?: () => void;
}

const SUGGESTED_QUESTIONS = [
  "What does this month's hotspot count vs. historical median mean for CDRRMO monitoring?",
  "How should our CDRRMO interpret the VIIRS and MODIS detections for this period?",
  "What data limitations should we note in our LGU situational briefing?",
];

const DEFAULT_DISCLAIMER =
  "CDRRMO Advisory AI interpretation only. Satellite detections are not confirmed fires, forecasts, or emergency instructions. Coordinate field verification and operational decisions through official CDRRMO, BFP, and LGU incident command channels.";

function formatAdvisoryAnswer(text: string) {
  const parts = text.split(/(Computed values:|Interpretation:|Limitations:)/gi);
  return parts.map((part, index) => {
    if (/^(Computed values:|Interpretation:|Limitations:)$/i.test(part)) {
      return (
        <strong key={index} className="assistant-section-heading">
          {part}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

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

export function AssistantPanel({ summary, onClose }: AssistantPanelProps) {
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
        <div className="assistant-header-top">
          <div>
            <p className="assistant-eyebrow">
              CDRRMO DECISION SUPPORT · GEMINI AI
            </p>
            <h2 id="assistant-panel-title" className="assistant-title">
              CDRRMO Fire Advisory Assistant
            </h2>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close CDRRMO Advisory AI"
              className="assistant-close-button"
            >
              ×
            </button>
          ) : null}
        </div>
        <p className="assistant-intro">
          Data-grounded situational analysis and monitoring guidance for City &amp; Municipal DRRM Offices.
        </p>
        {summary ? (
          <div className="assistant-context-pill" aria-label="Active advisory scope">
            {summary.region.name} · {summary.period.year}-{String(summary.period.month).padStart(2, "0")}
          </div>
        ) : null}
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
          Question for the CDRRMO Advisory AI
        </label>
        <textarea
          id="assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={AI_MAX_QUESTION_LENGTH}
          rows={3}
          placeholder="Ask a CDRRMO monitoring or situational question about the selected region and period"
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
            {isLoading ? "Generating advisory..." : "Get CDRRMO Advisory"}
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
        <h3 className="assistant-answer-title">CDRRMO Situational Advisory</h3>
        {isLoading ? (
          <p className="assistant-answer-copy">
            Preparing a CDRRMO situational advisory from the supplied analytics...
          </p>
        ) : answer ? (
          <p className="assistant-answer-copy assistant-answer-result">
            {formatAdvisoryAnswer(answer)}
          </p>
        ) : !summary ? (
          <p className="assistant-answer-copy">
            Select a region and month to enable CDRRMO advisories grounded in the
            dashboard analytics.
          </p>
        ) : (
          <p className="assistant-answer-copy">
            Ask a question to receive a data-grounded CDRRMO situational advisory.
          </p>
        )}
      </div>

      <p className="assistant-disclaimer">
        {disclaimer}
      </p>
    </section>
  );
}
