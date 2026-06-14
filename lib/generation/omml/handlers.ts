const OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";

type ConvertFn = (el: Element) => string;

function child(el: Element, name: string): Element | null {
  for (const c of Array.from(el.children)) {
    if (c.localName === name) return c;
  }
  return null;
}

function childrenByName(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === name);
}

function mAttr(el: Element, attr: string): string {
  return (
    el.getAttributeNS(OMML_NS, attr) ??
    el.getAttribute(`m:${attr}`) ??
    el.getAttribute(attr) ??
    ""
  );
}

export function convertChildrenEl(el: Element, convert: ConvertFn): string {
  return Array.from(el.childNodes)
    .map((node) => {
      if (node.nodeType === 3 /* TEXT_NODE */) {
        const text = node.textContent ?? "";
        // Skip whitespace-only text nodes (XML formatting between elements)
        return /^\s*$/.test(text) ? "" : text;
      }
      if (node.nodeType === 1 /* ELEMENT_NODE */) return convert(node as Element);
      return "";
    })
    .join("");
}

function escapeLatexText(text: string): string {
  return text.replace(/%/g, "\\%").replace(/#/g, "\\#");
}

// Glyph→LaTeX command table, mirroring markitdown omml.py do_nary
const NARY_OPS: Record<string, string> = {
  "∑": "\\sum",
  "∫": "\\int",
  "∬": "\\iint",
  "∭": "\\iiint",
  "∏": "\\prod",
  "∮": "\\oint",
  "⋂": "\\bigcap",
  "⋃": "\\bigcup",
  "⨆": "\\bigsqcup",
  "⋁": "\\bigvee",
  "⋀": "\\bigwedge",
  "⊕": "\\bigoplus",
  "⊗": "\\bigotimes",
};

// Operator bases that take subscript/superscript limits directly (not \overset/\underset)
const LIM_OPS = new Set(["lim", "max", "min", "sup", "inf", "gcd", "det"]);

const ACCENT_CMDS: Record<string, string> = {
  "̂": "\\hat",   // combining circumflex
  "ˆ": "\\hat",
  "^": "\\hat",
  "̃": "\\tilde", // combining tilde
  "˜": "\\tilde",
  "~": "\\tilde",
  "̄": "\\bar",   // combining macron
  "ˉ": "\\bar",
  "‾": "\\overline",
  "⃗": "\\vec",   // combining right arrow above
  "→": "\\vec",
  "̇": "\\dot",   // combining dot above
  "˙": "\\dot",
  "̈": "\\ddot",  // combining diaeresis
  "¨": "\\ddot",
};

const FUNC_NAMES: Record<string, string> = {
  sin: "\\sin", cos: "\\cos", tan: "\\tan", cot: "\\cot",
  sec: "\\sec", csc: "\\csc", sinh: "\\sinh", cosh: "\\cosh",
  tanh: "\\tanh", log: "\\log", ln: "\\ln", exp: "\\exp",
  lim: "\\lim", max: "\\max", min: "\\min", sup: "\\sup",
  inf: "\\inf", gcd: "\\gcd", det: "\\det", deg: "\\deg",
  arg: "\\arg", dim: "\\dim", hom: "\\hom", ker: "\\ker", Pr: "\\Pr",
};

const DELIM_MAP: Record<string, string> = {
  "|": "\\vert", "‖": "\\Vert",
  "⌈": "\\lceil", "⌉": "\\rceil",
  "⌊": "\\lfloor", "⌋": "\\rfloor",
};

function mapDelim(c: string): string {
  return DELIM_MAP[c] ?? c;
}

export const HANDLERS: Record<string, (el: Element, convert: ConvertFn) => string> = {
  // Fraction
  f: (el, convert) => {
    const num = child(el, "num");
    const den = child(el, "den");
    return `\\frac{${num ? convertChildrenEl(num, convert) : ""}}{${den ? convertChildrenEl(den, convert) : ""}}`;
  },

  // Radical
  rad: (el, convert) => {
    const radPr = child(el, "radPr");
    const degHide = radPr ? child(radPr, "degHide") : null;
    const hidden = degHide ? mAttr(degHide, "val") !== "0" : false;
    const degEl = child(el, "deg");
    const eEl = child(el, "e");
    const e = eEl ? convertChildrenEl(eEl, convert) : "";
    const deg = (!hidden && degEl) ? convertChildrenEl(degEl, convert).trim() : "";
    return deg ? `\\sqrt[${deg}]{${e}}` : `\\sqrt{${e}}`;
  },

  // Superscript
  sSup: (el, convert) => {
    const base = child(el, "e");
    const sup = child(el, "sup");
    return `{${base ? convertChildrenEl(base, convert) : ""}}^{${sup ? convertChildrenEl(sup, convert) : ""}}`;
  },

  // Subscript
  sSub: (el, convert) => {
    const base = child(el, "e");
    const sub = child(el, "sub");
    return `{${base ? convertChildrenEl(base, convert) : ""}}_{${sub ? convertChildrenEl(sub, convert) : ""}}`;
  },

  // Sub + Superscript
  sSubSup: (el, convert) => {
    const base = child(el, "e");
    const sub = child(el, "sub");
    const sup = child(el, "sup");
    return `{${base ? convertChildrenEl(base, convert) : ""}}_{${sub ? convertChildrenEl(sub, convert) : ""}}^{${sup ? convertChildrenEl(sup, convert) : ""}}`;
  },

  // N-ary operator (sum, integral, product, …) — mirrors markitdown omml.py do_nary
  nary: (el, convert) => {
    const naryPr = child(el, "naryPr");
    const chrEl = naryPr ? child(naryPr, "chr") : null;
    const limLocEl = naryPr ? child(naryPr, "limLoc") : null;
    const subHideEl = naryPr ? child(naryPr, "subHide") : null;
    const supHideEl = naryPr ? child(naryPr, "supHide") : null;
    // Per OMML spec, when m:chr is absent the default operator is ∫
    const chrChar = chrEl ? mAttr(chrEl, "val") : "∫";
    const op = NARY_OPS[chrChar] ?? chrChar; // fallback: emit raw glyph
    const limLoc = limLocEl ? mAttr(limLocEl, "val") : "subSup";
    const limits = limLoc === "undOvr" ? "\\limits" : "";
    const subHide = subHideEl ? mAttr(subHideEl, "val") === "1" : false;
    const supHide = supHideEl ? mAttr(supHideEl, "val") === "1" : false;
    const subEl = child(el, "sub");
    const supEl = child(el, "sup");
    const eEl = child(el, "e");
    const sub = !subHide && subEl ? convertChildrenEl(subEl, convert) : "";
    const sup = !supHide && supEl ? convertChildrenEl(supEl, convert) : "";
    const e = eEl ? convertChildrenEl(eEl, convert) : "";
    return `${op}${limits}${sub ? `_{${sub}}` : ""}${sup ? `^{${sup}}` : ""}${e ? ` ${e}` : ""}`;
  },

  // Matrix
  m: (el, convert) => {
    const rows = childrenByName(el, "mr").map((row) => {
      const cells = childrenByName(row, "e");
      return cells.map((c) => convertChildrenEl(c, convert)).join(" & ");
    });
    return `\\begin{matrix}${rows.join(" \\\\ ")}\\end{matrix}`;
  },

  // Delimiter
  d: (el, convert) => {
    const dPr = child(el, "dPr");
    const begChrEl = dPr ? child(dPr, "begChr") : null;
    const endChrEl = dPr ? child(dPr, "endChr") : null;
    const sepChrEl = dPr ? child(dPr, "sepChr") : null;
    const beg = mapDelim(begChrEl ? (mAttr(begChrEl, "val") || ".") : "(");
    const end = mapDelim(endChrEl ? (mAttr(endChrEl, "val") || ".") : ")");
    const sep = sepChrEl ? mAttr(sepChrEl, "val") : "|";
    const eEls = childrenByName(el, "e");
    const inner = eEls.map((e) => convertChildrenEl(e, convert)).join(` ${sep} `);
    return `\\left${beg}${inner}\\right${end}`;
  },

  // Accent (hat, vec, tilde, …)
  acc: (el, convert) => {
    const accPr = child(el, "accPr");
    const chrEl = accPr ? child(accPr, "chr") : null;
    const chrChar = chrEl ? mAttr(chrEl, "val") : "̂";
    const cmd = ACCENT_CMDS[chrChar] ?? "\\hat";
    const eEl = child(el, "e");
    return `${cmd}{${eEl ? convertChildrenEl(eEl, convert) : ""}}`;
  },

  // Bar (overline / underline)
  bar: (el, convert) => {
    const barPr = child(el, "barPr");
    const posEl = barPr ? child(barPr, "pos") : null;
    const pos = posEl ? mAttr(posEl, "val") : "top";
    const eEl = child(el, "e");
    const e = eEl ? convertChildrenEl(eEl, convert) : "";
    return pos === "bot" ? `\\underline{${e}}` : `\\overline{${e}}`;
  },

  // Grouping character (overbrace/underbrace/arbitrary) — mirrors markitdown omml.py do_groupChr
  groupChr: (el, convert) => {
    const groupChrPr = child(el, "groupChrPr");
    const chrEl = groupChrPr ? child(groupChrPr, "chr") : null;
    const posEl = groupChrPr ? child(groupChrPr, "pos") : null;
    const chrChar = chrEl ? mAttr(chrEl, "val") : "⏟";
    const pos = posEl ? mAttr(posEl, "val") : "bot";
    const eEl = child(el, "e");
    const e = eEl ? convertChildrenEl(eEl, convert) : "";
    if (chrChar === "⏞") return `\\overbrace{${e}}`; // ⏞
    if (chrChar === "⏟") return `\\underbrace{${e}}`; // ⏟
    return pos === "top" ? `\\overset{${chrChar}}{${e}}` : `\\underset{${chrChar}}{${e}}`;
  },

  // Named function (sin, cos, log, …)
  func: (el, convert) => {
    const fNameEl = child(el, "fName");
    const eEl = child(el, "e");
    const name = fNameEl ? fNameEl.textContent?.trim() ?? "" : "";
    const cmd = FUNC_NAMES[name] ?? `\\operatorname{${name}}`;
    return `${cmd}{${eEl ? convertChildrenEl(eEl, convert) : ""}}`;
  },

  // Lower limit — mirrors markitdown omml.py do_limLow
  limLow: (el, convert) => {
    const eEl = child(el, "e");
    const limEl = child(el, "lim");
    const base = eEl ? convertChildrenEl(eEl, convert) : "";
    const lim = limEl ? convertChildrenEl(limEl, convert) : "";
    const baseTrimmed = base.trim();
    if (LIM_OPS.has(baseTrimmed)) {
      const cmd = FUNC_NAMES[baseTrimmed] ?? `\\operatorname{${baseTrimmed}}`;
      return `${cmd}_{${lim}}`;
    }
    return `\\underset{${lim}}{${base}}`;
  },

  // Upper limit — mirrors markitdown omml.py do_limUpp
  limUpp: (el, convert) => {
    const eEl = child(el, "e");
    const limEl = child(el, "lim");
    const base = eEl ? convertChildrenEl(eEl, convert) : "";
    const lim = limEl ? convertChildrenEl(limEl, convert) : "";
    const baseTrimmed = base.trim();
    if (LIM_OPS.has(baseTrimmed)) {
      const cmd = FUNC_NAMES[baseTrimmed] ?? `\\operatorname{${baseTrimmed}}`;
      return `${cmd}^{${lim}}`;
    }
    return `\\overset{${lim}}{${base}}`;
  },

  // Text run — grab text from m:t child(ren)
  r: (el) => {
    return Array.from(el.children)
      .filter((c) => c.localName === "t")
      .map((t) => escapeLatexText(t.textContent ?? ""))
      .join("");
  },

  // Bare text element
  t: (el) => escapeLatexText(el.textContent ?? ""),

  // Transparent containers — just convert children
  e: (el, convert) => convertChildrenEl(el, convert),
  num: (el, convert) => convertChildrenEl(el, convert),
  den: (el, convert) => convertChildrenEl(el, convert),
  deg: (el, convert) => convertChildrenEl(el, convert),
  sub: (el, convert) => convertChildrenEl(el, convert),
  sup: (el, convert) => convertChildrenEl(el, convert),
  lim: (el, convert) => convertChildrenEl(el, convert),
  fName: (el, convert) => convertChildrenEl(el, convert),
  oMath: (el, convert) => convertChildrenEl(el, convert),
};
