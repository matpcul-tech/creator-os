// Word wrap and fit for text drawn onto a picture (thumbnails, video frames).
// Pure math: the caller passes a measure function, so preview, export and tests share one layout.

/** Width of `text` at font size `size`, in the same pixels as the frame. */
export type Measure = (text: string, size: number) => number;

export type FitOptions = {
  maxWidth: number;
  maxHeight: number;
  maxSize: number;
  minSize: number;
  /** Line height as a multiple of the font size. */
  lineHeight?: number;
  maxLines?: number;
  /** Each step multiplies the size by this. */
  step?: number;
  /** Extra width per line as a multiple of the size, for an outline drawn around the letters. */
  outline?: number;
};

export type FitResult = {
  size: number;
  lines: string[];
  /** Distance between baselines in pixels. */
  lineHeight: number;
  /** Widest line, outline included. */
  width: number;
  /** Block height: every line gap plus one font size for the last line. */
  height: number;
  hyphenated: boolean;
  truncated: boolean;
};

const ELLIPSIS = "\u2026";
// Marks a wrap that broke a word into more pieces than allowed, so that size is rejected.
const OVERFLOW = "\u0000";

/** Splits one word into pieces that each fit, ending every piece but the last with a hyphen. */
export function breakWord(word: string, maxWidth: number, width: (text: string) => number): string[] {
  const chars = [...word];
  const pieces: string[] = [];
  let start = 0;
  while (start < chars.length) {
    const rest = chars.slice(start).join("");
    if (width(rest) <= maxWidth) {
      pieces.push(rest);
      break;
    }
    let end = start + 1;
    while (end < chars.length && width(chars.slice(start, end + 1).join("") + "-") <= maxWidth) end++;
    pieces.push(chars.slice(start, end).join("") + "-");
    start = end;
  }
  return pieces;
}

/** Greedy word wrap against maxWidth. A word wider than the line is hyphenated only when asked. */
export function wrapText(
  text: string,
  maxWidth: number,
  width: (text: string) => number,
  hyphenate = false,
  maxPieces = Infinity,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (hyphenate && width(word) > maxWidth) {
      if (line) lines.push(line);
      const pieces = breakWord(word, maxWidth, width);
      if (pieces.length > maxPieces) return [...lines, line, ...pieces].filter(Boolean).concat(OVERFLOW);
      lines.push(...pieces.slice(0, -1));
      line = pieces[pieces.length - 1] ?? "";
      continue;
    }
    const next = line ? `${line} ${word}` : word;
    if (line && width(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Finds the largest font size, stepping down from maxSize, at which the wrapped text fits both
 * maxWidth and maxHeight. Long words are hyphenated only when no size down to minSize fits them
 * whole, and a single break per word is tried before more. If even that is too tall, the text is cut at the last line that fits and ends with an
 * ellipsis. The result never exceeds maxWidth.
 */
export function fitText(text: string, measure: Measure, opts: FitOptions): FitResult {
  const lh = opts.lineHeight ?? 1.08;
  const step = Math.min(0.98, Math.max(0.5, opts.step ?? 0.94));
  const maxLines = Math.max(1, opts.maxLines ?? Infinity);
  const outline = opts.outline ?? 0;
  const minSize = Math.max(1, Math.min(opts.minSize, opts.maxSize));
  const clean = text.replace(/\s+/g, " ").trim();

  const layout = (size: number, hyphenate: boolean, maxPieces = Infinity) => {
    const width = (s: string) => measure(s, size) + outline * size;
    const wrapped = wrapText(clean, opts.maxWidth, width, hyphenate, maxPieces);
    const overflow = wrapped[wrapped.length - 1] === OVERFLOW;
    const lines = overflow ? wrapped.slice(0, -1) : wrapped;
    const widest = lines.length ? Math.max(...lines.map(width)) : 0;
    const height = lines.length ? (lines.length - 1) * size * lh + size : 0;
    const fits = !overflow && widest <= opts.maxWidth && height <= opts.maxHeight && lines.length <= maxLines;
    return { size, lines, width: widest, height, fits, lineHeight: size * lh };
  };
  const sizes: number[] = [];
  for (let size = opts.maxSize; size > minSize; size *= step) sizes.push(size);
  sizes.push(minSize);

  // Whole words first, then at most one break per word, then as many breaks as it takes.
  for (const [hyphenate, maxPieces] of [[false, Infinity], [true, 2], [true, Infinity]] as const) {
    for (const size of sizes) {
      const result = layout(size, hyphenate, maxPieces);
      if (result.fits) return { ...result, hyphenated: hyphenate && result.lines.some((l) => l.endsWith("-")), truncated: false };
    }
  }

  // Still too tall at the smallest size: keep the lines that fit and end with an ellipsis.
  const size = minSize;
  const width = (s: string) => measure(s, size) + outline * size;
  const all = layout(size, true).lines;
  const room = Math.max(1, Math.min(maxLines, Math.floor((opts.maxHeight - size) / (size * lh)) + 1));
  const lines = all.slice(0, room);
  if (all.length > lines.length && lines.length) {
    let last = lines[lines.length - 1].replace(/-$/, "");
    while (last && width(last + ELLIPSIS) > opts.maxWidth) last = [...last].slice(0, -1).join("");
    lines[lines.length - 1] = last.trimEnd() + ELLIPSIS;
  }
  const widest = lines.length ? Math.max(...lines.map(width)) : 0;
  return {
    size,
    lines,
    lineHeight: size * lh,
    width: widest,
    height: lines.length ? (lines.length - 1) * size * lh + size : 0,
    hyphenated: lines.some((l) => l.endsWith("-")),
    truncated: all.length > lines.length,
  };
}

export type SafeArea = { left: number; right: number; top: number; bottom: number };

/**
 * Where text may go on a frame. Landscape keeps 90% of the width. Vertical (TikTok, Reels,
 * Shorts) keeps clear of the side button rail on the right and the caption area at the bottom.
 */
export function safeArea(w: number, h: number): SafeArea {
  if (h > w) return { left: w * 0.07, right: w * 0.89, top: h * 0.1, bottom: h * 0.82 };
  return { left: w * 0.05, right: w * 0.95, top: h * 0.07, bottom: h * 0.93 };
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
