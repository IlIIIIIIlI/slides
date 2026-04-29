import { NextRequest, NextResponse } from "next/server";
import { scratPresentation } from "@/app/slides";
import { validatePresentation } from "@/core/validation";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = body.presentationId ?? scratPresentation.id;

  if (id !== scratPresentation.id) {
    return NextResponse.json({ error: "Presentation not found" }, { status: 404 });
  }

  const report = validatePresentation(scratPresentation);
  return NextResponse.json(report);
}

export async function GET() {
  const report = validatePresentation(scratPresentation);
  return NextResponse.json(report);
}
