// Pure canvas drawing for thumbnails. Runs in the browser only.

import { clamp, fitText, safeArea, type Measure, type SafeArea } from "@/lib/text/fit";

export type ThumbFormat = "youtube" | "vertical";
export type ThumbLayout = "bottom" | "center" | "band";

export const THUMB_SIZES: Record<ThumbFormat, { w: number; h: number; label: string }> = {
  youtube: { w: 1280, h: 720, label: "YouTube 1280x720" },
  vertical: { w: 1080, h: 1920, label: "Shorts, TikTok, Reels 1080x1920" },
};

export type ThumbPalette = {
  id: string;
  name: string;
  fill: string; // text color
  stroke: string; // outline color
  band: string; // band / accent color
  bgFrom: string; // fallback background gradient when there is no photo
  bgTo: string;
};

export function palettes(brand?: { primaryColor?: string; accentColor?: string }): ThumbPalette[] {
  const list: ThumbPalette[] = [];
  if (brand?.primaryColor && brand?.accentColor) {
    list.push({
      id: "brand",
      name: "Brand colors",
      fill: "#FFFFFF",
      stroke: brand.primaryColor,
      band: brand.accentColor,
      bgFrom: brand.primaryColor,
      bgTo: brand.accentColor,
    });
  }
  list.push(
    { id: "yellow", name: "Bold yellow", fill: "#FFE600", stroke: "#000000", band: "#000000", bgFrom: "#1f2937", bgTo: "#111827" },
    { id: "white", name: "Clean white", fill: "#FFFFFF", stroke: "#000000", band: "#111827", bgFrom: "#0f172a", bgTo: "#334155" },
    { id: "red", name: "Red pop", fill: "#FFFFFF", stroke: "#7f1d1d", band: "#E11D48", bgFrom: "#450a0a", bgTo: "#111827" },
  );
  return list;
}

// Default text anchor for each layout, as fractions of the canvas.
export function layoutAnchor(layout: ThumbLayout, format: ThumbFormat): { x: number; y: number } {
  if (layout === "center") return { x: 0.5, y: 0.5 };
  if (layout === "band") return { x: 0.5, y: format === "youtube" ? 0.2 : 0.14 };
  return { x: 0.06, y: format === "youtube" ? 0.86 : 0.8 };
}

export const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
// Line height and outline as multiples of the font size. Layout and drawing both use these.
export const LINE_HEIGHT = 1.08;
export const OUTLINE = 0.14;

export type ThumbTextLayout = {
  size: number;
  lines: string[];
  lineHeight: number;
  align: CanvasTextAlign;
  /** Where fillText draws: the left edge for left aligned text, the center otherwise. */
  x: number;
  top: number;
  width: number;
  height: number;
  safe: SafeArea;
};

/**
 * Places thumbnail text: wraps and shrinks it until it fits the safe area, then moves the block
 * so it stays inside even when the anchor was dragged near an edge. Pure, so tests and the
 * canvas share the same math.
 */
export function layoutThumbText(opts: {
  format: ThumbFormat;
  layout: ThumbLayout;
  text: string;
  anchor: { x: number; y: number };
  scale: number;
  measure: Measure;
}): ThumbTextLayout {
  const { w, h } = THUMB_SIZES[opts.format];
  const safe = safeArea(w, h);
  const safeW = safe.right - safe.left;
  const safeH = safe.bottom - safe.top;
  const base = opts.format === "youtube" ? h * 0.17 : w * 0.13;
  const maxSize = base * opts.scale;
  const align: CanvasTextAlign = opts.layout === "bottom" ? "left" : "center";
  const ax = opts.anchor.x * w;
  const ay = opts.anchor.y * h;
  // Text wraps to the whole safe width, then slides back inside if the anchor sits near an edge.
  const fit = fitText(opts.text, opts.measure, {
    maxWidth: safeW,
    maxHeight: safeH * (opts.format === "vertical" ? 0.6 : 0.8),
    maxSize,
    minSize: Math.min(maxSize, base * 0.3),
    lineHeight: LINE_HEIGHT,
    maxLines: opts.format === "vertical" ? 5 : 3,
    outline: OUTLINE,
  });
  const pad = (fit.size * OUTLINE) / 2; // the outline reaches this far past the letters
  const x =
    align === "left"
      ? clamp(ax, safe.left, safe.right - fit.width) + pad
      : clamp(ax, safe.left + fit.width / 2, safe.right - fit.width / 2);
  // Bottom layout anchors at the last line; the others center the block.
  const wantTop = opts.layout === "bottom" ? ay - fit.height : ay - fit.height / 2;
  const top = clamp(wantTop, safe.top, safe.bottom - fit.height);
  return { size: fit.size, lines: fit.lines, lineHeight: fit.lineHeight, align, x, top, width: fit.width, height: fit.height, safe };
}

export function drawThumbnail(
  canvas: HTMLCanvasElement,
  opts: {
    format: ThumbFormat;
    layout: ThumbLayout;
    palette: ThumbPalette;
    text: string;
    anchor: { x: number; y: number };
    scale: number; // 0.6 to 1.6 text size multiplier
    image: HTMLImageElement | null;
  },
) {
  const { w, h } = THUMB_SIZES[opts.format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background: cover-fit photo, or a palette gradient.
  if (opts.image && opts.image.naturalWidth > 0) {
    const img = opts.image;
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, opts.palette.bgFrom);
    g.addColorStop(1, opts.palette.bgTo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Darken behind the text so it stays readable on any photo.
  if (opts.layout === "bottom") {
    const g = ctx.createLinearGradient(0, h * 0.35, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (opts.layout === "center") {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, w, h);
  }

  const text = opts.text.trim().toUpperCase();
  if (!text) return;

  const fontAt = (size: number) => `900 ${Math.round(size)}px ${FONT}`;
  const measure: Measure = (line, size) => {
    ctx.font = fontAt(size);
    return ctx.measureText(line).width;
  };
  const placed = layoutThumbText({ format: opts.format, layout: opts.layout, text, anchor: opts.anchor, scale: opts.scale, measure });
  const { lines, top, align } = placed;
  const size = placed.size;
  const lineH = placed.lineHeight;
  const blockH = placed.height;
  const ax = placed.x;

  if (opts.layout === "band") {
    const pad = size * 0.35;
    ctx.fillStyle = opts.palette.band;
    ctx.fillRect(0, top - pad, w, blockH + pad * 2);
  }

  ctx.font = fontAt(size);
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  lines.forEach((line, i) => {
    const y = top + i * lineH;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.06;
    ctx.lineWidth = size * OUTLINE;
    ctx.strokeStyle = opts.palette.stroke;
    ctx.strokeText(line, ax, y);
    ctx.restore();
    ctx.fillStyle = opts.palette.fill;
    ctx.fillText(line, ax, y);
  });
}
