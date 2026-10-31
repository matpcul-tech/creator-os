// Server side scene art. One palette for every card: branded background, big type,
// a simple diagram, or a bar or line chart. Optional stock sits behind the type.

import { readFileSync } from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import { frameSize, type Aspect, type SceneCard } from "@/lib/produce/types";
import { clip, plain, wrapLines, xml } from "@/lib/produce/text";

export const PALETTE = {
  bg0: "#070B14",
  bg1: "#162038",
  ink: "#F5F7FB",
  muted: "#A8B3CC",
  line: "#2C3A58",
  accent: "#3DDC97",
  accent2: "#7C8CFF",
  accent3: "#F0B429",
};

const SERIES = [PALETTE.accent, PALETTE.accent2, PALETTE.accent3, "#5ED0E8", "#F27D8A"];

export type ChartPoint = { label: string; value: number };

export type ParsedVisual =
  | { kind: "big-text"; headline: string }
  | { kind: "background"; headline: string }
  | { kind: "diagram"; steps: string[] }
  | { kind: "bar"; points: ChartPoint[] }
  | { kind: "line"; points: ChartPoint[] }
  | { kind: "stock"; query: string; headline: string };

function pointsFrom(body: string): ChartPoint[] {
  const chunks = body.includes("|") ? body.split("|") : body.split(",");
  const points: ChartPoint[] = [];
  chunks.map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const match = part.match(/^(.*?)(-?\d+(?:\.\d+)?)%?$/);
    if (!match) return;
    const value = Number(match[2]);
    if (!Number.isFinite(value)) return;
    const label = plain(match[1]) || `Item ${points.length + 1}`;
    points.push({ label: clip(label, 18), value });
  });
  return points.slice(0, 6);
}

export function parseVisual(visual: string, title: string): ParsedVisual {
  const raw = plain(visual);
  const lower = raw.toLowerCase();
  const headline = plain(title) || "Scene";
  const take = (prefix: string) => raw.slice(prefix.length).trim();
  if (lower.startsWith("stock:")) {
    return { kind: "stock", query: take("stock:") || headline, headline };
  }
  if (lower.startsWith("bar chart:")) {
    const points = pointsFrom(take("bar chart:"));
    return points.length ? { kind: "bar", points } : { kind: "big-text", headline };
  }
  if (lower.startsWith("bar:")) {
    const points = pointsFrom(take("bar:"));
    return points.length ? { kind: "bar", points } : { kind: "big-text", headline };
  }
  if (lower.startsWith("line chart:")) {
    const points = pointsFrom(take("line chart:"));
    return points.length >= 2 ? { kind: "line", points } : { kind: "big-text", headline };
  }
  if (lower.startsWith("line:")) {
    const points = pointsFrom(take("line:"));
    return points.length >= 2 ? { kind: "line", points } : { kind: "big-text", headline };
  }
  if (lower.startsWith("diagram:")) {
    const steps = take("diagram:")
      .split(/\s*>\s*|\s*\|\s*/)
      .map((step) => clip(step, 32))
      .filter(Boolean)
      .slice(0, 4);
    return steps.length >= 2 ? { kind: "diagram", steps } : { kind: "big-text", headline };
  }
  if (lower.startsWith("big-text:")) return { kind: "big-text", headline: clip(take("big-text:") || headline, 80) };
  if (lower.startsWith("big text:")) return { kind: "big-text", headline: clip(take("big text:") || headline, 80) };
  if (lower === "background") return { kind: "background", headline };
  if (lower.startsWith("background:")) return { kind: "background", headline: clip(take("background:") || headline, 80) };
  if (raw.includes(">")) {
    const steps = raw.split(/\s*>\s*/).map((step) => clip(step, 32)).filter(Boolean).slice(0, 4);
    if (steps.length >= 2) return { kind: "diagram", steps };
  }
  if (raw && raw !== headline) return { kind: "big-text", headline: clip(raw, 80) };
  return { kind: "big-text", headline };
}

export function fontFiles(): { regular: string; bold: string } {
  const dir = path.join(process.cwd(), "assets", "fonts");
  return {
    regular: path.join(dir, "DejaVuSans.ttf"),
    bold: path.join(dir, "DejaVuSans-Bold.ttf"),
  };
}

function textBlock(lines: string[], x: number, y: number, size: number, fill: string, weight: number, anchor: "middle" | "start" | "end"): string {
  const tspans = lines
    .map((line, index) => `<tspan x="${x}" y="${y + index * Math.round(size * 1.18)}">${xml(line)}</tspan>`)
    .join("");
  return `<text font-family="DejaVu Sans" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${tspans}</text>`;
}

function frame(width: number, height: number, channel: string, index: number, total: number, inner: string, credit = ""): string {
  const creditY = height - (width < height ? 300 : 150);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PALETTE.bg0}"/>
      <stop offset="1" stop-color="${PALETTE.bg1}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="${Math.round(width * 0.86)}" cy="${Math.round(height * 0.16)}" r="${Math.round(width * 0.22)}" fill="${PALETTE.accent}" opacity="0.08"/>
  <circle cx="${Math.round(width * 0.12)}" cy="${Math.round(height * 0.72)}" r="${Math.round(width * 0.16)}" fill="${PALETTE.accent2}" opacity="0.08"/>
  <rect x="0" y="0" width="${width}" height="10" fill="${PALETTE.accent}"/>
  ${textBlock([clip(channel, 28).toUpperCase()], 72, 78, 22, PALETTE.accent, 700, "start")}
  ${textBlock([`${String(index + 1).padStart(2, "0")}  /  ${String(total).padStart(2, "0")}`], width - 72, 78, 22, PALETTE.muted, 400, "end")}
  ${inner}
  ${credit ? textBlock([clip(credit, 64)], 72, creditY, 18, PALETTE.muted, 400, "start") : ""}
</svg>`;
}

function bigText(width: number, height: number, headline: string): string {
  const size = width < height ? 78 : 68;
  const maxChars = width < height ? 16 : 22;
  const lines = wrapLines(headline, maxChars, 5);
  const block = lines.length * Math.round(size * 1.18);
  const y = Math.round(height * 0.36) - Math.round(block / 2);
  return textBlock(lines.length ? lines : ["Scene"], width / 2, y, size, PALETTE.ink, 700, "middle");
}

function diagram(width: number, height: number, steps: string[]): string {
  const vertical = width < height;
  const parts: string[] = [];
  if (vertical) {
    const boxW = width - 180;
    const boxH = 150;
    const gap = 70;
    const total = steps.length * boxH + (steps.length - 1) * gap;
    let y = Math.round((height - total) / 2) - 40;
    steps.forEach((step, index) => {
      parts.push(`<rect x="90" y="${y}" width="${boxW}" height="${boxH}" rx="28" fill="#10192C" stroke="${SERIES[index % SERIES.length]}" stroke-width="3"/>`);
      const lines = wrapLines(step, 18, 2);
      parts.push(textBlock(lines, width / 2, y + (lines.length === 1 ? 88 : 68), 36, PALETTE.ink, 700, "middle"));
      if (index < steps.length - 1) {
        const mid = y + boxH + 18;
        parts.push(`<path d="M ${width / 2} ${mid} v 28" stroke="${PALETTE.muted}" stroke-width="4"/>`);
        parts.push(`<path d="M ${width / 2 - 10} ${mid + 22} l 10 14 l 10 -14" fill="${PALETTE.accent}"/>`);
      }
      y += boxH + gap;
    });
  } else {
    const gap = 48;
    const boxW = Math.floor((width - 160 - gap * (steps.length - 1)) / steps.length);
    const boxH = 220;
    const y = Math.round(height / 2) - 140;
    steps.forEach((step, index) => {
      const x = 80 + index * (boxW + gap);
      parts.push(`<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="28" fill="#10192C" stroke="${SERIES[index % SERIES.length]}" stroke-width="3"/>`);
      const lines = wrapLines(step, 12, 3);
      parts.push(textBlock(lines, x + boxW / 2, y + 90, 32, PALETTE.ink, 700, "middle"));
      if (index < steps.length - 1) {
        const ax = x + boxW + 8;
        parts.push(`<path d="M ${ax} ${y + boxH / 2} h 24" stroke="${PALETTE.muted}" stroke-width="4"/>`);
        parts.push(`<path d="M ${ax + 18} ${y + boxH / 2 - 8} l 14 8 l -14 8" fill="${PALETTE.accent}"/>`);
      }
    });
  }
  return parts.join("\n");
}

function barChart(width: number, height: number, points: ChartPoint[]): string {
  const left = 100;
  const right = width - 100;
  const top = Math.round(height * 0.28);
  const bottom = Math.round(height * (width < height ? 0.68 : 0.72));
  const max = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  const gap = 24;
  const barW = Math.max(28, Math.floor((right - left - gap * (points.length - 1)) / points.length));
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const y = top + ((bottom - top) * i) / 4;
    parts.push(`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="${PALETTE.line}" stroke-width="2"/>`);
  }
  points.forEach((point, index) => {
    const h = Math.max(8, ((bottom - top) * Math.abs(point.value)) / max);
    const x = left + index * (barW + gap);
    const y = bottom - h;
    parts.push(`<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="12" fill="${SERIES[index % SERIES.length]}"/>`);
    parts.push(textBlock([String(point.value)], x + barW / 2, y - 18, 26, PALETTE.ink, 700, "middle"));
    const labels = wrapLines(point.label, 10, 2);
    parts.push(textBlock(labels, x + barW / 2, bottom + 42, 22, PALETTE.muted, 400, "middle"));
  });
  return parts.join("\n");
}

function lineChart(width: number, height: number, points: ChartPoint[]): string {
  const left = 120;
  const right = width - 100;
  const top = Math.round(height * 0.3);
  const bottom = Math.round(height * (width < height ? 0.66 : 0.7));
  const max = Math.max(...points.map((point) => point.value), 1);
  const min = Math.min(...points.map((point) => point.value), 0);
  const span = Math.max(max - min, 1);
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? (left + right) / 2 : left + (index * (right - left)) / (points.length - 1);
    const y = bottom - ((point.value - min) / span) * (bottom - top);
    return { x, y, point };
  });
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const y = top + ((bottom - top) * i) / 4;
    parts.push(`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="${PALETTE.line}" stroke-width="2"/>`);
  }
  const d = coords.map((spot, index) => `${index === 0 ? "M" : "L"} ${spot.x.toFixed(1)} ${spot.y.toFixed(1)}`).join(" ");
  parts.push(`<path d="${d}" fill="none" stroke="${PALETTE.accent}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`);
  coords.forEach((spot) => {
    parts.push(`<circle cx="${spot.x}" cy="${spot.y}" r="9" fill="${PALETTE.ink}"/>`);
    parts.push(textBlock([String(spot.point.value)], spot.x, spot.y - 24, 24, PALETTE.ink, 700, "middle"));
    parts.push(textBlock(wrapLines(spot.point.label, 8, 2), spot.x, bottom + 40, 20, PALETTE.muted, 400, "middle"));
  });
  return parts.join("\n");
}

export function sceneSvg(
  card: SceneCard,
  aspect: Aspect,
  index: number,
  total: number,
  channel: string,
  stock?: { href: string; credit: string } | null,
): string {
  const { width, height } = frameSize(aspect);
  const parsed = parseVisual(card.visual, card.title);
  let inner = "";
  let credit = "";
  if (parsed.kind === "diagram") inner = diagram(width, height, parsed.steps);
  else if (parsed.kind === "bar") inner = barChart(width, height, parsed.points);
  else if (parsed.kind === "line") inner = lineChart(width, height, parsed.points);
  else if (parsed.kind === "stock" && stock?.href) {
    inner = `<image href="${xml(stock.href)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
      <rect width="${width}" height="${height}" fill="${PALETTE.bg0}" opacity="0.72"/>
      ${bigText(width, height, parsed.headline)}`;
    credit = stock.credit;
  } else if (parsed.kind === "background") {
    inner = bigText(width, height, parsed.headline);
  } else {
    const headline = parsed.kind === "big-text" || parsed.kind === "stock" ? parsed.headline : card.title;
    inner = bigText(width, height, headline);
  }
  return frame(width, height, channel || "Creator OS", index, total, inner, credit);
}

export function renderScenePng(svg: string, aspect: Aspect): Buffer {
  const { width } = frameSize(aspect);
  const fonts = fontFiles();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: {
      fontFiles: [fonts.regular, fonts.bold],
      loadSystemFonts: false,
      defaultFontFamily: "DejaVu Sans",
    },
  });
  return Buffer.from(resvg.render().asPng());
}

export function readFont(which: "regular" | "bold"): Buffer {
  const fonts = fontFiles();
  return readFileSync(which === "bold" ? fonts.bold : fonts.regular);
}
