import React from "react";
import katex from "katex";

// Inline-markdown renderer for slide text fields.
// Supports $$block math$$, $inline math$, **bold**, *italic*, and `code`.
// Math segments are rendered via KaTeX (throwOnError: false so invalid
// expressions show a styled error rather than crashing the slide).

// Token order: block math first to avoid $$  matching as two $...$  patterns.
const TOKEN_RE =
  /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

function renderKatex(latex: string, displayMode: boolean): React.ReactNode {
  const html = katex.renderToString(latex, { throwOnError: false, displayMode });
  return displayMode ? (
    <span
      className="block text-center my-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export function inlineMd(input: string | undefined | null): React.ReactNode {
  if (!input) return null;
  const parts = input.split(TOKEN_RE);
  return parts.map((part, i) => {
    if (!part) return null;

    // Block math: $$...$$
    if (part.startsWith("$$") && part.endsWith("$$")) {
      return (
        <React.Fragment key={i}>
          {renderKatex(part.slice(2, -2), true)}
        </React.Fragment>
      );
    }

    // Inline math: $...$
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      return (
        <React.Fragment key={i}>
          {renderKatex(part.slice(1, -1), false)}
        </React.Fragment>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="font-mono text-[0.92em] px-1 rounded bg-black/5">
          {part.slice(1, -1)}
        </code>
      );
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
    .replace(/\$\$([^$]+)\$\$/g, "$1")
    .replace(/\$([^$\n]+)\$/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");
}
