"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SlopReport, SlopViolation } from "@/core/validation/antislop";

interface SlopBadgeProps {
  report: SlopReport;
  variant?: "slide" | "deck";
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

export function SlopBadge({ report, variant = "deck" }: SlopBadgeProps) {
  const label = `${badgeLabel(report.score)} (${report.score})`;

  const topViolations = [...report.violations]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 3);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={badgeVariant(report.score)} className="cursor-default select-none tabIndex={0}">
            {variant === "deck" ? "Slop: " : ""}{label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 p-3">
          <p className="text-xs font-semibold mb-1">Anti-slop score: {report.score}/100</p>
          {topViolations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No violations found.</p>
          ) : (
            topViolations.map((v, i) => (
              <div key={i} className="text-xs">
                <span className="font-mono text-[10px] opacity-60">[{v.ruleId}]</span>{" "}
                {v.message}
              </div>
            ))
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
