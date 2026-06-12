import { JSDOM } from "jsdom";
import { HANDLERS, convertChildrenEl } from "./handlers";

const OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";

/** Recursively convert a single OMML element to LaTeX. */
export function convertOMathElement(el: Element): string {
  const handler = HANDLERS[el.localName];
  if (handler) return handler(el, convertOMathElement);
  // Fallback: return concatenated text content (never throw).
  return el.textContent ?? "";
}

/**
 * Convert an OMML fragment string (m:oMath or m:oMathPara root) to LaTeX.
 * Never throws; returns best-effort text on malformed input.
 */
export function ommlToLatex(omml: string): string {
  try {
    const dom = new JSDOM(omml, { contentType: "text/xml" });
    const root = dom.window.document.documentElement as unknown as Element;
    if (root.localName === "oMathPara") {
      const maths = root.getElementsByTagNameNS(OMML_NS, "oMath");
      return Array.from(maths).map(convertOMathElement).join(" ");
    }
    if (root.localName === "oMath") {
      return convertChildrenEl(root, convertOMathElement);
    }
    // Wrap in an oMath if passed a bare expression element
    const oMath = root.getElementsByTagNameNS(OMML_NS, "oMath")[0];
    if (oMath) return convertChildrenEl(oMath as unknown as Element, convertOMathElement);
    return convertChildrenEl(root, convertOMathElement);
  } catch {
    return "";
  }
}

// When extracting fragments from a larger XML document, the xmlns:m declaration
// may be on an ancestor element.  We inject it into each extracted fragment so
// that JSDOM can resolve the namespace correctly.
const NS_INJECTION = `xmlns:m="${OMML_NS}"`;

function ensureOmmlNs(fragment: string): string {
  return fragment.includes("xmlns:m")
    ? fragment
    : fragment.replace(/^(<m:\w+)/, `$1 ${NS_INJECTION}`);
}

/**
 * Pre-process an XML string from a DOCX/PPTX document:
 * replace m:oMathPara blocks with $$...$$ and inline m:oMath blocks with $...$.
 * Non-math content is returned byte-for-byte unchanged.
 */
export function preprocessMathXml(xml: string): string {
  // Replace display-math paragraphs first (they contain oMath as a child).
  xml = xml.replace(/<m:oMathPara[\s\S]*?<\/m:oMathPara>/g, (match) => {
    try {
      return `$$${ommlToLatex(ensureOmmlNs(match))}$$`;
    } catch {
      return match;
    }
  });
  // Replace remaining inline math elements.
  xml = xml.replace(/<m:oMath[\s\S]*?<\/m:oMath>/g, (match) => {
    try {
      return `$${ommlToLatex(ensureOmmlNs(match))}$`;
    } catch {
      return match;
    }
  });
  return xml;
}
