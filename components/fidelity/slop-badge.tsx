"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SlopReport, SlopViolation } from "@/core/validation/antislop";
import type { DetectReport, ImpeccableFinding } from "@/core/validation/impeccable";

/** Aggregate counts from Impeccable DetectReport[] (no vision required). */
export interface DetectCounts {
  errors: number;
  warns: number;
  infos: number;
  total: number;
}

export function aggregateDetectCounts(
  reports: DetectReport[] | undefined | null,
): DetectCounts {
  let errors = 0;
  let warns = 0;
  let infos = 0;
  for (const r of reports ?? []) {
    for (const f of r.findings) {
      if (f.severity === "error") errors += 1;
      else if (f.severity === "warn") warns += 1;
      else infos += 1;
    }
  }
  return { errors, warns, infos, total: errors + warns + infos };
}

interface SlopBadgeProps {
  /** Structural antislop report (optional when only design-detect is shown). */
  report?: SlopReport | null;
  /** Impeccable per-slide detect reports — sufficient to show the badge without vision. */
  detectReports?: DetectReport[] | null;
  /** Pre-aggregated counts (alternative to detectReports). */
  detectCounts?: Partial<DetectCounts> | null;
  variant?: "slide" | "deck";
  /** Override label prefix for detect-only mode. */
  detectLabel?: string;
}

const SEVERITY_ORDER: Record<SlopViolation["severity"], number> = {
  error: 0,
  warn: 1,
  info: 2,
};

function badgeVariant(score: number): "success" | "warning" | "destructive" {
  if (score >= 85) return "success";
  if (score >= 70) return "warning";
  return "destructive";
}

function badgeLabel(score: number): string {
  if (score >= 85) return "Crisp";
  if (score >= 70) return "Some tells";
  return "Sloppy";
}

function detectBadgeVariant(counts: DetectCounts): "success" | "warning" | "destructive" {
  if (counts.errors > 0) return "destructive";
  if (counts.warns > 0) return "warning";
  return "success";
}

function detectBadgeLabel(counts: DetectCounts): string {
  if (counts.total === 0) return "Design clean";
  const parts: string[] = [];
  if (counts.errors) parts.push(`${counts.errors} err`);
  if (counts.warns) parts.push(`${counts.warns} warn`);
  if (counts.infos && !counts.errors && !counts.warns) parts.push(`${counts.infos} info`);
  return parts.join(" · ") || "Design detect";
}

function topDetectFindings(reports: DetectReport[] | undefined | null, limit = 3): ImpeccableFinding[] {
  const all = (reports ?? []).flatMap((r) => r.findings);
  return [...all]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, limit);
}

export function SlopBadge({
  report,
  detectReports,
  detectCounts: detectCountsProp,
  variant = "deck",
  detectLabel = "Design detect",
}: SlopBadgeProps) {
  const fromReports = aggregateDetectCounts(detectReports);
  const counts: DetectCounts = {
    errors: detectCountsProp?.errors ?? fromReports.errors,
    warns: detectCountsProp?.warns ?? fromReports.warns,
    infos: detectCountsProp?.infos ?? fromReports.infos,
    total:
      detectCountsProp?.total ??
      (detectCountsProp
        ? (detectCountsProp.errors ?? 0) + (detectCountsProp.warns ?? 0) + (detectCountsProp.infos ?? 0)
        : fromReports.total),
  };

  const hasDetect = Boolean(detectReports?.length || detectCountsProp);
  const hasSlop = Boolean(report);

  // Detect-only path (no vision, no antislop report required)
  if (hasDetect && !hasSlop) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={detectBadgeVariant(counts)} className="cursor-default select-none" tabIndex={0}>
              {variant === "deck" ? `${detectLabel}: ` : ""}
              {detectBadgeLabel(counts)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs space-y-1 p-3">
            <p className="text-xs font-semibold mb-1">Impeccable design detect</p>
            <p className="text-xs text-muted-foreground">
              {counts.errors} error · {counts.warns} warn · {counts.infos} info
            </p>
            {topDetectFindings(detectReports).length === 0 ? (
              <p className="text-xs text-muted-foreground">No design findings.</p>
            ) : (
              topDetectFindings(detectReports).map((v, i) => (
                <div key={i} className="text-xs">
                  <span className="font-mono text-[10px] opacity-60">[{v.ruleId}]</span> {v.message}
                </div>
              ))
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!report) {
    return null;
  }

  const label = `${badgeLabel(report.score)} (${report.score})`;

  const topViolations = [...report.violations]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 3);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={badgeVariant(report.score)} className="cursor-default select-none" tabIndex={0}>
            {variant === "deck" ? "Slop: " : ""}
            {label}
            {hasDetect && counts.total > 0 ? (
              <span className="ml-1 opacity-80">· {detectBadgeLabel(counts)}</span>
            ) : null}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 p-3">
          <p className="text-xs font-semibold mb-1">Anti-slop score: {report.score}/100</p>
          {topViolations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No violations found.</p>
          ) : (
            topViolations.map((v, i) => (
              <div key={i} className="text-xs">
                <span className="font-mono text-[10px] opacity-60">[{v.ruleId}]</span> {v.message}
              </div>
            ))
          )}
          {hasDetect ? (
            <>
              <p className="text-xs font-semibold mt-2 mb-1">Design detect</p>
              <p className="text-xs text-muted-foreground">
                {counts.errors} error · {counts.warns} warn · {counts.infos} info
              </p>
              {topDetectFindings(detectReports).map((v, i) => (
                <div key={`d-${i}`} className="text-xs">
                  <span className="font-mono text-[10px] opacity-60">[{v.ruleId}]</span> {v.message}
                </div>
              ))}
            </>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
