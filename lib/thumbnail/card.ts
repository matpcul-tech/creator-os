// Channel thumbnail: navy field, one GPU, one amber chain, large Inter type.
// The same SVG is what the preview and the PNG export both use.

import { Resvg } from "@resvg/resvg-js";
import { xml } from "@/lib/produce/text";
import { resvgFontConfig } from "@/lib/produce/visuals";

export type ThumbExportFormat = "youtube" | "vertical";

export const THUMB_EXPORT: Record<ThumbExportFormat, { w: number; h: number }> = {
  youtube: { w: 1280, h: 720 },
  vertical: { w: 1080, h: 1920 },
};

const NAVY = "#0B1F33";
const BONE = "#F4F1EA";
const AMBER = "#F2A900";
const TEAL = "#1FA39A";

function isKey(token: string): boolean {
  const clean = token.replace(/[^A-Z0-9%]/gi, "").toUpperCase();
  return clean === "COLLATERAL" || clean === "OWNS" || /^\d+%$/.test(clean);
}

function fitSize(token: string, maxWidth: number, preferred: number): number {
  const chars = Math.max(1, token.replace(/[^A-Z0-9%]/gi, "").length);
  const fitted = Math.floor(maxWidth / (chars * 0.74));
  return Math.max(42, Math.min(preferred, fitted));
}

function gpuGroup(x: number, y: number, scale: number): string {
  const w = 280 * scale;
  const h = 170 * scale;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const chain = [
    `M ${x - 36 * scale} ${y + h * 0.22}`,
    `C ${x - 78 * scale} ${y - 46 * scale}, ${x + w + 70 * scale} ${y - 58 * scale}, ${x + w + 18 * scale} ${cy}`,
    `C ${x + w + 8 * scale} ${y + h + 64 * scale}, ${x - 10 * scale} ${y + h + 58 * scale}, ${x + 30 * scale} ${y + h + 8 * scale}`,
  ].join(" ");
  const lockX = x + 8 * scale;
  const lockY = y + h + 8 * scale;
  const lockW = 118 * scale;
  const lockH = 78 * scale;
  return `<g transform="rotate(8 ${cx} ${cy})">
    <path d="${chain}" fill="none" stroke="${AMBER}" stroke-width="${26 * scale}" stroke-linecap="round"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${18 * scale}" fill="${NAVY}" stroke="${BONE}" stroke-width="${5 * scale}"/>
    <rect x="${x + 18 * scale}" y="${y + 22 * scale}" width="${w - 36 * scale}" height="${h - 54 * scale}" rx="${8 * scale}" fill="none" stroke="#5B6B7A" stroke-width="${3 * scale}"/>
    <circle cx="${x + 70 * scale}" cy="${y + h / 2}" r="${22 * scale}" fill="none" stroke="${TEAL}" stroke-width="${4 * scale}"/>
    <circle cx="${x + 140 * scale}" cy="${y + h / 2}" r="${22 * scale}" fill="none" stroke="${TEAL}" stroke-width="${4 * scale}"/>
    <circle cx="${x + 210 * scale}" cy="${y + h / 2}" r="${22 * scale}" fill="none" stroke="${TEAL}" stroke-width="${4 * scale}"/>
    <rect x="${lockX}" y="${lockY}" width="${lockW}" height="${lockH}" rx="${10 * scale}" fill="${AMBER}"/>
    <path d="M ${lockX + lockW * 0.28} ${lockY + 4 * scale} v ${-18 * scale} a ${lockW * 0.22} ${lockW * 0.22} 0 0 1 ${lockW * 0.44} 0 v ${18 * scale}" fill="none" stroke="${AMBER}" stroke-width="${8 * scale}"/>
    <text x="${lockX + lockW / 2}" y="${lockY + lockH * 0.68}" text-anchor="middle" font-family="Inter Black" font-size="${28 * scale}" fill="${NAVY}">LIEN</text>
  </g>`;
}

export function thumbnailSvg(raw: string, format: ThumbExportFormat, scale = 1): string {
  const { w, h } = THUMB_EXPORT[format];
  const words = (raw || "YOUR GPU IS COLLATERAL").trim().toUpperCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const found = words.findIndex((word) => isKey(word));
  const keyAt = found >= 0 ? found : Math.max(0, words.length - 1);
  const left = Math.round(w * 0.06);
  const textWidth = Math.round(w * (format === "youtube" ? 0.46 : 0.88));
  const preferred = (format === "youtube" ? 84 : 96) * scale;
  const keyPreferred = (format === "youtube" ? 104 : 118) * scale;
  const bodySize = fitSize(words.filter((_, index) => index !== keyAt).join(" ") || "YOUR", textWidth, preferred);
  const keySize = fitSize(words[keyAt] || "COLLATERAL", textWidth, keyPreferred);
  const lines: { text: string; fill: string; size: number }[] = [];
  const pushWrapped = (tokens: string[], size: number, fill: string) => {
    const maxChars = Math.max(4, Math.floor(textWidth / (size * 0.58)));
    let line = "";
    for (const token of tokens) {
      const next = line ? `${line} ${token}` : token;
      if (line && next.length > maxChars) {
        lines.push({ text: line, fill, size });
        line = token;
      } else {
        line = next;
      }
    }
    if (line) lines.push({ text: line, fill, size });
  };
  pushWrapped(words.slice(0, keyAt), bodySize, BONE);
  lines.push({ text: words[keyAt] || "COLLATERAL", fill: AMBER, size: keySize });
  pushWrapped(words.slice(keyAt + 1), bodySize, BONE);
  const blockH = lines.reduce((sum, line) => sum + Math.round(line.size * 1.08), 0);
  let y = format === "youtube" ? Math.max(120, Math.round((h - blockH) / 2) + lines[0].size) : 220 + lines[0].size;
  const tspans = lines
    .map((line) => {
      const span = `<tspan x="${left}" y="${y}" fill="${line.fill}" font-size="${line.size}">${xml(line.text)}</tspan>`;
      y += Math.round(line.size * 1.08);
      return span;
    })
    .join("");
  const gpuScale = format === "youtube" ? 0.92 : 1.45;
  const gpuW = 280 * gpuScale;
  const gpuX = format === "youtube" ? w * 0.64 : (w - gpuW) / 2;
  const gpuY = format === "youtube" ? h * 0.28 : h * 0.46;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${NAVY}"/>
  <rect x="0" y="0" width="${w}" height="8" fill="${TEAL}"/>
  <text font-family="Inter Black" font-weight="900">${tspans}</text>
  ${gpuGroup(gpuX, gpuY, gpuScale)}
</svg>`;
}

export function renderThumbnailPng(text: string, format: ThumbExportFormat, scale = 1): Buffer {
  const { w } = THUMB_EXPORT[format];
  const resvg = new Resvg(thumbnailSvg(text, format, scale), {
    fitTo: { mode: "width", value: w },
    font: resvgFontConfig(),
  });
  return Buffer.from(resvg.render().asPng());
}
