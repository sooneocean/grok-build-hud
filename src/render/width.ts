/**
 * Terminal visual width helpers (plain text, no ANSI).
 * CJK / emoji count as 2 cells so truncation matches what the eye sees.
 */

const GRAPHEME_SEGMENTER =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function segmentGraphemes(text: string): string[] {
  if (!text) return [];
  if (!GRAPHEME_SEGMENTER) return Array.from(text);
  return Array.from(GRAPHEME_SEGMENTER.segment(text), (s) => s.segment);
}

/** East-Asian wide + emoji → 2 cells; ASCII → 1. */
export function codePointCellWidth(cp: number): number {
  if (cp <= 0x1f) return 0;
  // Combining marks
  if (cp >= 0x300 && cp <= 0x36f) return 0;
  // Emoji blocks (rough)
  if (cp >= 0x1f300 && cp <= 0x1faff) return 2;
  if (cp >= 0x1f600 && cp <= 0x1f64f) return 2;
  // CJK Unified Ideographs & common wide ranges
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x2fffd)
  ) {
    return 2;
  }
  return 1;
}

export function graphemeCellWidth(g: string): number {
  if (!g) return 0;
  if (/\p{Extended_Pictographic}/u.test(g)) return 2;
  let w = 0;
  let has = false;
  for (const ch of Array.from(g)) {
    if (/^\p{Mark}$/u.test(ch) || ch === "\u200D" || ch === "\uFE0F") continue;
    has = true;
    const cp = ch.codePointAt(0);
    if (cp !== undefined) w = Math.max(w, codePointCellWidth(cp));
  }
  return has ? w : 0;
}

/** Visible cell width of plain text (no ANSI). */
export function visualLen(str: string): number {
  let n = 0;
  for (const g of segmentGraphemes(str)) n += graphemeCellWidth(g);
  return n;
}

/** Truncate plain text to max visible cells, append … if cut. */
export function truncateVisible(str: string, maxCells: number): string {
  if (maxCells <= 0) return "";
  if (visualLen(str) <= maxCells) return str;
  const ellipsis = "…";
  const budget = Math.max(1, maxCells - visualLen(ellipsis));
  let out = "";
  let w = 0;
  for (const g of segmentGraphemes(str)) {
    const gw = graphemeCellWidth(g);
    if (w + gw > budget) break;
    out += g;
    w += gw;
  }
  return out + ellipsis;
}

/** Pad plain label on the right to target visual width. */
export function padEndVisible(str: string, width: number): string {
  const cur = visualLen(str);
  if (cur >= width) return str;
  return str + " ".repeat(width - cur);
}
