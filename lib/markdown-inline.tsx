import React from "react";

// Tiny inline-markdown renderer for slide text fields.
// Supports **bold**, *italic*, and `code`. Anything else passes through as text.
// Used so that `**AI & Agents**` produced by the model renders as bold text,
// not as literal asterisks.

const TOKEN_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

export function inlineMd(input: string | undefined | null): React.ReactNode {
  if (!input) return null;
  const parts = input.split(TOKEN_RE);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="font-mono text-[0.92em] px-1 rounded bg-black/5">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/** Strip all inline markdown markers (returns plain text). Useful when the
 *  surrounding element already applies the desired styling (e.g. the framework
 *  lead-in, which is already bold + colored). */
export function stripMd(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");
}
