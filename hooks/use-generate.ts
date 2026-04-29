"use client";

import { useState, useRef, useCallback } from "react";

export type GenerateStep =
  | "idle"
  | "extracting"
  | "outlining"
  | "drafting"
  | "validating"
  | "done"
  | "error";

export interface GenerateResult {
  id: string;
  title: string;
  slideCount: number;
}

interface GenerateState {
  step: GenerateStep;
  progress: number;
  stepLabel: string;
  result: GenerateResult | null;
  error: string | null;
  warnings: { slideIndex: number; field: string; message: string }[];
}

const STEP_LABELS: Record<GenerateStep, string> = {
  idle: "Ready",
  extracting: "Extracting source…",
  outlining: "Planning outline with Claude…",
  drafting: "Drafting slides with Claude…",
  validating: "Validating draft…",
  done: "Deck ready",
  error: "Generation failed",
};

// Stage progress weights (must total 100). drafting gets the bulk because it's the slowest.
const STAGE_BASE: Record<Exclude<GenerateStep, "idle" | "error" | "done">, number> = {
  extracting: 5,
  outlining: 20,
  drafting: 40,
  validating: 95,
};

const IDLE_STATE: GenerateState = {
  step: "idle",
  progress: 0,
  stepLabel: STEP_LABELS.idle,
  result: null,
  error: null,
  warnings: [],
};

interface SSEMessage {
  event: string;
  data: string;
}

async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<SSEMessage> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) yield { event, data };
    }
  }
}

export function useGenerate() {
  const [state, setState] = useState<GenerateState>(IDLE_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (formData: FormData) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ ...IDLE_STATE, step: "extracting", progress: STAGE_BASE.extracting, stepLabel: STEP_LABELS.extracting });

    let res: Response;
    try {
      res = await fetch("/api/analyze/stream", {
        method: "POST",
        body: formData,
        signal: ctrl.signal,
      });
    } catch (e) {
      setState({ ...IDLE_STATE, step: "error", error: e instanceof Error ? e.message : "Network error", stepLabel: STEP_LABELS.error });
      return;
    }

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      setState({ ...IDLE_STATE, step: "error", error: err.error || "Generation failed", stepLabel: STEP_LABELS.error });
      return;
    }

    try {
      for await (const msg of parseSSE(res.body)) {
        let payload: Record<string, unknown> = {};
        try { payload = JSON.parse(msg.data); } catch { /* keep empty */ }

        if (msg.event === "stage") {
          const stage = payload.stage as GenerateStep;
          setState((prev) => ({
            ...prev,
            step: stage,
            progress: STAGE_BASE[stage as keyof typeof STAGE_BASE] ?? prev.progress,
            stepLabel: STEP_LABELS[stage] ?? prev.stepLabel,
          }));
        } else if (msg.event === "draft-progress") {
          const done = (payload.slidesDone as number) ?? 0;
          const total = (payload.slidesTotal as number) ?? 1;
          const frac = total > 0 ? done / total : 0;
          const draftSpan = STAGE_BASE.validating - STAGE_BASE.drafting;
          setState((prev) => ({ ...prev, progress: STAGE_BASE.drafting + frac * draftSpan }));
        } else if (msg.event === "validate") {
          const warnings = (payload.warnings as GenerateState["warnings"]) ?? [];
          setState((prev) => ({ ...prev, warnings }));
        } else if (msg.event === "done") {
          const result: GenerateResult = {
            id: payload.id as string,
            title: payload.title as string,
            slideCount: payload.slideCount as number,
          };
          setState((prev) => ({ ...prev, step: "done", progress: 100, stepLabel: STEP_LABELS.done, result }));
          return;
        } else if (msg.event === "error") {
          setState((prev) => ({ ...prev, step: "error", error: (payload.message as string) ?? "Generation failed", stepLabel: STEP_LABELS.error }));
          return;
        }
      }
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      setState((prev) => ({ ...prev, step: "error", error: e instanceof Error ? e.message : "Stream error", stepLabel: STEP_LABELS.error }));
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(IDLE_STATE);
  }, []);

  return { state, generate, reset };
}
