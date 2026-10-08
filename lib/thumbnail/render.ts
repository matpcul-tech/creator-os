// Pure canvas drawing for thumbnails. Runs in the browser only.

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

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

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

  const base = opts.format === "youtube" ? h * 0.17 : w * 0.13;
  let size = base * opts.scale;
  const maxWidth = w * (opts.layout === "bottom" ? 0.86 : 0.88);
  let lines: string[] = [];
  for (let i = 0; i < 30; i++) {
    ctx.font = `900 ${Math.round(size)}px ${FONT}`;
    lines = wrap(ctx, text, maxWidth);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= 3 && widest <= maxWidth) break;
    size *= 0.92;
  }
  const lineH = size * 1.08;
  const blockH = lineH * lines.length;
  const align: CanvasTextAlign = opts.layout === "bottom" ? "left" : "center";
  const ax = opts.anchor.x * w;
  const ay = opts.anchor.y * h;
  // Bottom layout anchors at the last line; the others center the block.
  const top = opts.layout === "bottom" ? ay - blockH : ay - blockH / 2;

  if (opts.layout === "band") {
    const pad = size * 0.35;
    ctx.fillStyle = opts.palette.band;
    ctx.fillRect(0, top - pad, w, blockH + pad * 2);
  }

  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  lines.forEach((line, i) => {
    const y = top + i * lineH;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.06;
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = opts.palette.stroke;
    ctx.strokeText(line, ax, y);
    ctx.restore();
    ctx.fillStyle = opts.palette.fill;
    ctx.fillText(line, ax, y);
  });
}
