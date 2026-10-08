import test from "node:test";
import assert from "node:assert/strict";
import { breakWord, fitText, safeArea, wrapText, type Measure } from "../lib/text/fit";
import { LINE_HEIGHT, OUTLINE, THUMB_SIZES, layoutThumbText, type ThumbFormat, type ThumbLayout } from "../lib/thumbnail/render";

// Heavy uppercase type is roughly 0.78 of the size per letter, spaces narrower.
const measure: Measure = (text, size) => [...text].reduce((sum, ch) => sum + (ch === " " ? 0.3 : 0.78) * size, 0);
const LONG = "IT HAS BEEN FOUND THAT THIS ALLOWS YOU TO ALWAYS STAY YOUNGER THAN YOUR BIRTHDAY";
const WORD = "SUPERCALIFRAGILISTICEXPIALIDOCIOUSLY";
const words = (lines: string[]) => lines.join(" ").replace(/-\s/g, "").replace(/\u2026$/, "");

test("a long sentence wraps and shrinks until every line fits the width and height", () => {
  const fit = fitText(LONG, measure, { maxWidth: 900, maxHeight: 900, maxSize: 220, minSize: 50, outline: OUTLINE, lineHeight: LINE_HEIGHT });
  assert.ok(fit.size < 220, "it had to shrink");
  for (const line of fit.lines) assert.ok(measure(line, fit.size) + OUTLINE * fit.size <= 900, `line too wide: ${line}`);
  assert.ok(fit.height <= 900);
  assert.equal(fit.lines.join(" "), LONG, "no word is lost or reordered");
  assert.equal(fit.truncated, false);
  assert.equal(fit.lineHeight, fit.size * LINE_HEIGHT);
});

test("short text keeps the largest size", () => {
  const fit = fitText("STAY YOUNG", measure, { maxWidth: 900, maxHeight: 900, maxSize: 120, minSize: 40 });
  assert.equal(fit.size, 120);
  assert.deepEqual(fit.lines, ["STAY YOUNG"]);
});

test("the size steps down gradually rather than jumping to the minimum", () => {
  const fit = fitText(LONG, measure, { maxWidth: 900, maxHeight: 2000, maxSize: 220, minSize: 20, maxLines: 4 });
  // The next step up must not fit, otherwise the search skipped a size.
  const bigger = fitText(LONG, measure, { maxWidth: 900, maxHeight: 2000, maxSize: fit.size / 0.94 + 0.01, minSize: fit.size / 0.94 + 0.01, maxLines: 4 });
  assert.ok(bigger.truncated || bigger.lines.length > 4 || bigger.width > 900);
});

test("a single word too long for the line shrinks first, then breaks with a hyphen", () => {
  const shrinks = fitText(WORD, measure, { maxWidth: 900, maxHeight: 900, maxSize: 200, minSize: 20 });
  assert.equal(shrinks.lines.length, 1, "small enough to fit whole at the minimum");
  assert.equal(shrinks.hyphenated, false);
  assert.ok(measure(shrinks.lines[0], shrinks.size) <= 900);

  const breaks = fitText(`STAY ${WORD} NOW`, measure, { maxWidth: 900, maxHeight: 900, maxSize: 200, minSize: 60 });
  assert.equal(breaks.hyphenated, true);
  for (const line of breaks.lines) assert.ok(measure(line, breaks.size) <= 900, `line too wide: ${line}`);
  assert.equal(words(breaks.lines), `STAY ${WORD} NOW`, "the hyphen pieces join back into the word");
});

test("breakWord pieces all fit and only the last has no hyphen", () => {
  const width = (s: string) => measure(s, 100);
  const pieces = breakWord(WORD, 500, width);
  assert.ok(pieces.length > 1);
  pieces.forEach((piece, i) => {
    assert.ok(width(piece) <= 500, piece);
    assert.equal(piece.endsWith("-"), i < pieces.length - 1);
  });
  assert.equal(pieces.join("").replace(/-/g, ""), WORD);
});

test("wrapText leaves an overlong word whole unless asked to hyphenate", () => {
  const width = (s: string) => measure(s, 100);
  assert.deepEqual(wrapText(`A ${WORD} B`, 500, width), ["A", WORD, "B"]);
  assert.ok(wrapText(`A ${WORD} B`, 500, width, true).every((line) => width(line) <= 500));
});

test("text that cannot fit the height is cut with an ellipsis and still never exceeds the width", () => {
  const text = Array.from({ length: 40 }, () => LONG).join(" ");
  const fit = fitText(text, measure, { maxWidth: 600, maxHeight: 300, maxSize: 100, minSize: 40, maxLines: 5 });
  assert.equal(fit.truncated, true);
  assert.ok(fit.lines[fit.lines.length - 1].endsWith("\u2026"));
  assert.ok(fit.height <= 300);
  for (const line of fit.lines) assert.ok(measure(line, fit.size) <= 600, line);
});

test("vertical frames keep extra room for the TikTok and Reels buttons and caption", () => {
  const v = safeArea(1080, 1920);
  assert.ok(v.right <= 1080 * 0.9 && v.left >= 1080 * 0.05);
  assert.ok(v.bottom <= 1920 * 0.85 && v.top >= 1920 * 0.08);
  const y = safeArea(1280, 720);
  assert.ok(Math.abs((y.right - y.left) / 1280 - 0.9) < 0.001, "landscape keeps 90% of the width");
});

const formats: ThumbFormat[] = ["vertical", "youtube"];
const layouts: ThumbLayout[] = ["bottom", "center", "band"];
const anchors = [
  { x: 0.5, y: 0.5 },
  { x: 0.06, y: 0.8 },
  { x: 0.98, y: 0.98 },
  { x: 0.02, y: 0.05 },
  { x: 0.9, y: 0.2 },
];

test("thumbnail text stays inside the safe area for every format, layout, size and dragged anchor", () => {
  for (const format of formats)
    for (const layout of layouts)
      for (const anchor of anchors)
        for (const scale of [0.6, 1, 1.6])
          for (const text of [LONG, WORD, `${WORD} ${WORD} ${LONG}`, "HI"]) {
            const p = layoutThumbText({ format, layout, text, anchor, scale, measure });
            const { w, h } = THUMB_SIZES[format];
            const pad = (p.size * OUTLINE) / 2;
            const label = `${format} ${layout} ${JSON.stringify(anchor)} x${scale} ${text.slice(0, 12)}`;
            for (const line of p.lines) {
              const lw = measure(line, p.size);
              const left = p.align === "left" ? p.x - pad : p.x - lw / 2 - pad;
              const right = p.align === "left" ? p.x + lw + pad : p.x + lw / 2 + pad;
              assert.ok(left >= p.safe.left - 0.5 && right <= p.safe.right + 0.5, `${label}: "${line}" spans ${left.toFixed(0)}..${right.toFixed(0)}`);
              assert.ok(left >= 0 && right <= w, `${label}: off the frame`);
            }
            assert.ok(p.top >= p.safe.top - 0.5 && p.top + p.height <= p.safe.bottom + 0.5, `${label}: off the safe height`);
            assert.ok(p.top + p.height <= h);
          }
});

test("the reported caption line fits a vertical frame at the biggest size", () => {
  const p = layoutThumbText({ format: "vertical", layout: "center", text: LONG, anchor: { x: 0.5, y: 0.5 }, scale: 1.6, measure });
  assert.ok(p.lines.length >= 3 && p.lines.length <= 5, p.lines.join(" / "));
  assert.equal(p.lines.join(" "), LONG);
});

test("a long word gets one hyphen break before it is chopped into more pieces", () => {
  const fit = fitText(`STAY ${WORD} YOUNG`, measure, { maxWidth: 885, maxHeight: 830, maxSize: 225, minSize: 42, maxLines: 5, outline: OUTLINE });
  assert.equal(fit.hyphenated, true);
  assert.equal(fit.lines.filter((l) => l.endsWith("-")).length, 1, fit.lines.join(" / "));
  assert.equal(words(fit.lines), `STAY ${WORD} YOUNG`);
});
