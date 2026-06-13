import { NextRequest, NextResponse } from "next/server";
import { scratPresentation } from "@/app/slides";
import { validatePresentation } from "@/core/validation";
import { lintPresentation } from "@/core/validation/antislop";
import type { PresentationSpec } from "@/core/schemas/types";

const VALID_MODES = new Set(["antislop", "fidelity", "all"]);

function resolvePresentation(body: Record<string, unknown>): PresentationSpec {
  if (body.presentation && typeof body.presentation === "object") {
    return body.presentation as PresentationSpec;
  }
  return scratPresentation;
}

export async function POST(req: NextRequest) {
  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const mode = (body.mode as string | undefined) ?? "all";

  if (!VALID_MODES.has(mode)) {
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  }

  const presentation = resolvePresentation(body);

  if (mode === "antislop") {
    const slopReport = lintPresentation(presentation);
    return NextResponse.json({ slopReport });
  }

  if (mode === "fidelity") {
    const qaReport = validatePresentation(presentation);
    return NextResponse.json({ fidelityReport: qaReport });
  }

  // mode === "all"
  const [qaReport, slopReport] = [
    validatePresentation(presentation),
    lintPresentation(presentation),
  ];
  return NextResponse.json({ fidelityReport: qaReport, slopReport });
}

export async function GET() {
  const qaReport = validatePresentation(scratPresentation);
  const slopReport = lintPresentation(scratPresentation);
  return NextResponse.json({ fidelityReport: qaReport, slopReport });
}
