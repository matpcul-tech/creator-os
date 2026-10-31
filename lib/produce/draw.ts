// Flat navy cards for described charts and diagrams. Captions stay in the
// burned in line, so the card itself holds the chart, the quote, or the diagram.

import { Resvg } from "@resvg/resvg-js";
import type { Beat } from "@/lib/produce/describe";
import { clip, wrapLines, xml } from "@/lib/produce/text";
import { resvgFontConfig } from "@/lib/produce/visuals";
import { frameSize, type Aspect, type ChannelPalette } from "@/lib/produce/types";

function lines(text: string, max: number, count: number): string[] {
  const wrapped = wrapLines(text, max, count);
  return wrapped.length ? wrapped : [clip(text, max)];
}

function text(
  value: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  anchor: "start" | "middle" | "end",
  weight = 700,
  family = "Inter",
): string {
  return `<text x="${x}" y="${y}" font-family="${family}" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${xml(value)}</text>`;
}

function data(value: string, x: number, y: number, size: number, fill: string, anchor: "start" | "middle" | "end", weight = 400): string {
  return text(value, x, y, size, fill, anchor, weight, "IBM Plex Sans");
}

function block(rows: string[], x: number, y: number, size: number, fill: string, anchor: "start" | "middle" | "end", weight = 700): string {
  return rows
    .map((row, index) => text(row, x, y + index * Math.round(size * 1.2), size, fill, anchor, weight))
    .join("");
}

function frame(width: number, height: number, palette: ChannelPalette, channel: string, index: number, total: number, inner: string, source: string, bare = false): string {
  if (bare) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${palette.navy}"/>
  ${inner}
</svg>`;
  }
  const sourceY = 98;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${palette.navy}"/>
  <rect x="0" y="0" width="${width}" height="8" fill="${palette.teal}"/>
  ${text(clip(channel || "Sovereign", 22).toUpperCase(), 56, 64, 22, palette.teal, "start")}
  ${text(`${String(index + 1).padStart(2, "0")}  /  ${String(total).padStart(2, "0")}`, width - 56, 64, 22, palette.slate, "end", 400)}
  ${inner}
  ${source ? data(`SOURCE: ${clip(source, width < height ? 32 : 42)}`, 56, sourceY, 16, palette.slate, "start") : ""}
</svg>`;
}

function gpuIcon(x: number, y: number, scale: number, palette: ChannelPalette): string {
  const w = 280 * scale;
  const h = 170 * scale;
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${18 * scale}" fill="${palette.navy}" stroke="${palette.bone}" stroke-width="${4 * scale}"/>
    <rect x="${x + 18 * scale}" y="${y + 22 * scale}" width="${w - 36 * scale}" height="${h - 54 * scale}" rx="${8 * scale}" fill="none" stroke="${palette.slate}" stroke-width="${3 * scale}"/>
    <circle cx="${x + 70 * scale}" cy="${y + h / 2}" r="${22 * scale}" fill="none" stroke="${palette.teal}" stroke-width="${3 * scale}"/>
    <circle cx="${x + 140 * scale}" cy="${y + h / 2}" r="${22 * scale}" fill="none" stroke="${palette.teal}" stroke-width="${3 * scale}"/>
    <circle cx="${x + 210 * scale}" cy="${y + h / 2}" r="${22 * scale}" fill="none" stroke="${palette.teal}" stroke-width="${3 * scale}"/>
  </g>`;
}

function boxes(width: number, height: number, labels: string[], palette: ChannelPalette, vertical: boolean): string {
  const items = labels.slice(0, 4);
  const parts: string[] = [];
  if (vertical) {
    const boxW = width - 160;
    const boxH = 120;
    const gap = 70;
    let y = 180;
    items.forEach((label, index) => {
      parts.push(`<rect x="80" y="${y}" width="${boxW}" height="${boxH}" rx="18" fill="none" stroke="${palette.bone}" stroke-width="3"/>`);
      parts.push(block(lines(label, 22, 2), width / 2, y + 52, 28, palette.bone, "middle"));
      if (index < items.length - 1) {
        parts.push(`<path d="M ${width / 2} ${y + boxH + 8} v 40" stroke="${palette.amber}" stroke-width="4"/>`);
      }
      y += boxH + gap;
    });
  } else {
    const gap = 70;
    const boxW = Math.floor((width - 140 - gap * (items.length - 1)) / items.length);
    const boxH = 160;
    const y = Math.round(height * 0.38);
    items.forEach((label, index) => {
      const x = 70 + index * (boxW + gap);
      parts.push(`<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="18" fill="none" stroke="${palette.bone}" stroke-width="3"/>`);
      parts.push(block(lines(label, 16, 3), x + boxW / 2, y + 70, 26, palette.bone, "middle"));
      if (index < items.length - 1) {
        parts.push(`<path d="M ${x + boxW + 8} ${y + boxH / 2} h ${gap - 20}" stroke="${palette.amber}" stroke-width="4"/>`);
      }
    });
  }
  return parts.join("");
}

function cdsChart(width: number, height: number, palette: ChannelPalette): string {
  const left = 140;
  const right = width - 120;
  const top = 220;
  const bottom = Math.round(height * (width < height ? 0.62 : 0.72));
  const y1000 = top + (bottom - top) * 0.38;
  const yLow = bottom - 30;
  const x2025 = left + 40;
  const x15 = left + (right - left) * 0.72;
  const x21 = left + (right - left) * 0.9;
  const y1038 = top + 70;
  const y1145 = top + 36;
  return [
    text("CoreWeave 5-year CDS spread (basis points)", width / 2, 130, width < height ? 28 : 34, palette.bone, "middle"),
    `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${palette.slate}" stroke-width="2"/>`,
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="${palette.slate}" stroke-width="2"/>`,
    `<line x1="${left}" y1="${y1000}" x2="${right}" y2="${y1000}" stroke="${palette.amber}" stroke-width="3" stroke-dasharray="10 8"/>`,
    text("DISTRESS LINE 1,000 bp", right, y1000 - 12, 18, palette.amber, "end", 400),
    `<path d="M ${x2025} ${yLow} L ${x15} ${y1038} L ${x21} ${y1145}" fill="none" stroke="${palette.teal}" stroke-width="5"/>`,
    `<circle cx="${x2025}" cy="${yLow}" r="7" fill="${palette.slate}"/>`,
    text("+164% vs a year earlier (CNBC)", x2025 + 16, yLow + 28, 16, palette.slate, "start", 400),
    `<circle cx="${x15}" cy="${y1038}" r="8" fill="${palette.bone}"/>`,
    `<circle cx="${x21}" cy="${y1145}" r="8" fill="${palette.amber}"/>`,
    text("1,038 bp", x15, y1038 - 16, 20, palette.bone, "middle"),
    text("Oct 15, 2026", x15, y1038 + 36, 16, palette.slate, "middle", 400),
    text("1,145 bp", x21, y1145 - 16, 20, palette.amber, "middle"),
    text("Oct 21, 2026", x21, y1145 + 36, 16, palette.slate, "middle", 400),
    text("Oct 2025", left, bottom + 36, 16, palette.slate, "start", 400),
    text("Oct 2026", right, bottom + 36, 16, palette.slate, "end", 400),
  ].join("");
}

function chartValue(label: string): number {
  const money = label.match(/(\d+(?:\.\d+)?)\s*(?:B|M|bp|%)/i);
  if (money) return Number(money[1]);
  const comma = label.match(/(\d{1,3}(?:,\d{3})+)/);
  if (comma) return Number(comma[1].replace(/,/g, ""));
  const nums = [...label.matchAll(/\d+(?:\.\d+)?/g)].map((item) => Number(item[0])).filter((n) => n < 1900 || n > 2100);
  return nums[nums.length - 1] ?? 1;
}

function bars(width: number, height: number, labels: string[], palette: ChannelPalette, title: string): string {
  const values = labels.map((label) => ({ label, value: Math.max(chartValue(label), 0.01) }));
  const max = Math.max(...values.map((item) => item.value), 1);
  const left = 100;
  const bottom = Math.round(height * (width < height ? 0.62 : 0.7));
  const top = 200;
  const gap = 36;
  const barW = Math.max(48, Math.floor((width - 200 - gap * (values.length - 1)) / Math.max(values.length, 1)));
  const colors = [palette.slate, palette.amber, palette.teal, palette.bone, palette.amber];
  const parts = [text(title, width / 2, 130, width < height ? 28 : 34, palette.bone, "middle")];
  values.forEach((item, index) => {
    const h = Math.max(12, ((bottom - top) * item.value) / max);
    const x = left + index * (barW + gap);
    const y = bottom - h;
    const amber = /amber|interest|31b|640|15\.78/i.test(item.label);
    const teal = /teal|income|128/i.test(item.label);
    const fill = amber ? palette.amber : teal ? palette.teal : colors[index % colors.length];
    parts.push(`<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="10" fill="${fill}"/>`);
    parts.push(block(lines(item.label, 14, 3), x + barW / 2, bottom + 36, 18, palette.bone, "middle", 400));
  });
  return parts.join("");
}

function stacked(width: number, height: number, palette: ChannelPalette): string {
  const segments = [
    { label: "Recourse debt $31.4B", value: 31.4, fill: palette.amber },
    { label: "Non-recourse debt $3.7B", value: 3.7, fill: palette.slate },
    { label: "Operating lease liabilities $16.3B", value: 16.3, fill: palette.teal },
  ];
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const barW = Math.min(980, width - 160);
  const x = (width - barW) / 2;
  const y = Math.round(height * 0.38);
  let cursor = x;
  const parts = [
    text("CoreWeave debt, June 30, 2026", width / 2, 140, 32, palette.bone, "middle"),
    text("> $51B debt and obligations (CNBC)", width / 2, 190, 22, palette.amber, "middle", 400),
  ];
  segments.forEach((item) => {
    const w = (barW * item.value) / total;
    parts.push(`<rect x="${cursor}" y="${y}" width="${w}" height="90" fill="${item.fill}"/>`);
    cursor += w;
  });
  segments.forEach((item, index) => {
    parts.push(text(item.label, width / 2, y + 150 + index * 36, 22, palette.bone, "middle", 400));
  });
  parts.push(text("Callout: $20.7B due through 2030", width / 2, y + 280, 26, palette.amber, "middle"));
  return parts.join("");
}

function waffle(width: number, height: number, palette: ChannelPalette): string {
  const cols = 10;
  const cell = width < height ? 48 : 36;
  const gap = 8;
  const grid = cols * cell + (cols - 1) * gap;
  const x0 = (width - grid) / 2;
  const y0 = width < height ? 280 : 180;
  const parts = [
    block(lines("Gartner: over 80% of neoclouds cease independent operations by 2030", width < height ? 28 : 48, 2), width / 2, 120, width < height ? 26 : 30, palette.bone, "middle"),
  ];
  for (let i = 0; i < 100; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const fill = i < 80 ? palette.amber : palette.teal;
    parts.push(`<rect x="${x0 + col * (cell + gap)}" y="${y0 + row * (cell + gap)}" width="${cell}" height="${cell}" rx="4" fill="${fill}"/>`);
  }
  parts.push(text("80 amber, 20 teal. Footer: Reuters cited 2032. Gartner release says 2030.", width / 2, y0 + grid + 48, 16, palette.slate, "middle", 400));
  return parts.join("");
}

function table(width: number, height: number, rows: string[], palette: ChannelPalette, title: string): string {
  const parts = [text(title, width / 2, 140, 34, palette.bone, "middle")];
  const top = 200;
  const rowH = width < height ? 90 : 70;
  rows.slice(0, 6).forEach((row, index) => {
    const y = top + index * rowH;
    parts.push(`<rect x="80" y="${y}" width="${width - 160}" height="${rowH - 10}" rx="10" fill="none" stroke="${palette.slate}" stroke-width="2"/>`);
    parts.push(text(clip(row, width < height ? 36 : 64), 110, y + 42, 24, /record low|>30|down/i.test(row) ? palette.amber : palette.bone, "start", 400));
  });
  return parts.join("");
}

function quoteCard(width: number, height: number, quote: string, attribution: string, palette: ChannelPalette, amber: boolean): string {
  return [
    block(lines(quote, width < height ? 22 : 36, 6), width / 2, Math.round(height * 0.32), width < height ? 32 : 36, amber ? palette.amber : palette.bone, "middle"),
    text(clip(attribution, 70), width / 2, Math.round(height * 0.72), 20, palette.slate, "middle", 400),
  ].join("");
}

function chain(width: number, height: number, labels: string[], tags: string[], palette: ChannelPalette, title: string): string {
  return [
    text(title, width / 2, 130, 30, palette.bone, "middle"),
    boxes(width, height, labels, palette, width < height),
    ...tags.slice(0, 4).map((tag, index) => text(clip(tag, 70), width / 2, Math.round(height * 0.72) + index * 32, 20, palette.slate, "middle", 400)),
  ].join("");
}

function ledger(width: number, height: number, palette: ChannelPalette): string {
  const left = ["Provider credit risk", "Change-of-control risk", "Keys and logs moved by someone else"];
  const right = ["Depreciation", "Power and cooling", "Maintenance and upgrades", "Lender risk if you finance"];
  const mid = width / 2;
  const parts = [
    text("Removed by owning", mid / 2 + 20, 150, 26, palette.teal, "middle"),
    text("Still yours", mid + mid / 2 - 20, 150, 26, palette.amber, "middle"),
  ];
  left.forEach((item, index) => parts.push(text(item, 80, 240 + index * 70, 22, palette.bone, "start", 400)));
  right.forEach((item, index) => parts.push(text(item, mid + 40, 240 + index * 70, 22, palette.bone, "start", 400)));
  return parts.join("");
}

function pathColumn(
  x: number,
  y: number,
  w: number,
  labels: string[],
  palette: ChannelPalette,
  arrow: string,
  accentIndex: number,
  accentLabel: string,
): string {
  const boxH = 88;
  const gap = 36;
  const parts: string[] = [];
  labels.forEach((label, index) => {
    const top = y + index * (boxH + gap);
    const accent = index === accentIndex;
    parts.push(`<rect x="${x}" y="${top}" width="${w}" height="${boxH}" rx="14" fill="${palette.navy}" stroke="${accent ? palette.amber : palette.bone}" stroke-width="3"/>`);
    parts.push(text(label, x + w / 2, top + (accent ? 38 : 54), accent ? 22 : 24, palette.bone, "middle"));
    if (accent && accentLabel) parts.push(data(accentLabel, x + w / 2, top + 68, 18, palette.amber, "middle", 700));
    if (index < labels.length - 1) {
      const mid = x + w / 2;
      parts.push(`<path d="M ${mid} ${top + boxH + 6} v ${gap - 12}" stroke="${arrow}" stroke-width="4"/>`);
    }
  });
  return parts.join("");
}

function compare(width: number, height: number, palette: ChannelPalette, providerState = 0): string {
  const states = ["ACQUIRED", "RESTRUCTURED", "DEFAULT"];
  const state = states[Math.min(2, Math.max(0, providerState))];
  const vertical = width < height;
  const colW = vertical ? 470 : 760;
  const leftX = vertical ? 48 : 80;
  const rightX = width - colW - leftX;
  const top = vertical ? 190 : 176;
  const boxH = 88;
  const gap = 36;
  const ownedTop = top + boxH + gap;
  const boundaryH = boxH + gap + boxH + 150;
  return [
    text("RENTED", leftX + colW / 2, top - 28, 26, palette.amber, "middle"),
    text("OWNED", rightX + colW / 2, top - 28, 26, palette.teal, "middle"),
    pathColumn(leftX, top, colW, ["YOU", "PROVIDER", "PROVIDER'S LENDERS", "GPU"], palette, palette.amber, 1, state),
    `<rect x="${rightX - 8}" y="${ownedTop - 16}" width="${colW + 16}" height="${boundaryH}" rx="22" fill="none" stroke="${palette.teal}" stroke-width="3"/>`,
    pathColumn(rightX, ownedTop, colW, ["YOU", "GPU"], palette, palette.teal, -1, ""),
    data("Encryption keys", rightX + 36, ownedTop + boxH + gap + boxH + 36, 22, palette.teal, "start", 700),
    data("Access control", rightX + 36, ownedTop + boxH + gap + boxH + 72, 22, palette.teal, "start", 700),
    data("Audit logs", rightX + 36, ownedTop + boxH + gap + boxH + 108, 22, palette.teal, "start", 700),
    data("Inside your boundary", rightX + colW / 2, ownedTop + boundaryH + 28, 16, palette.slate, "middle"),
  ].join("");
}

function youChain(width: number, height: number, palette: ChannelPalette): string {
  const vertical = width < height;
  const labels = ["LENDERS", "NEOCLOUD", "BIG CUSTOMERS"];
  const gap = vertical ? 24 : 40;
  const boxW = Math.floor((width - (vertical ? 72 : 140) - gap * 2) / 3);
  const boxH = vertical ? 96 : 118;
  const y = vertical ? 210 : 196;
  const x0 = vertical ? 36 : 70;
  const parts: string[] = [text("Where you sit on the chain", width / 2, vertical ? 168 : 156, vertical ? 28 : 32, palette.bone, "middle")];
  labels.forEach((label, index) => {
    const x = x0 + index * (boxW + gap);
    parts.push(`<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="16" fill="none" stroke="${palette.bone}" stroke-width="3"/>`);
    parts.push(text(label, x + boxW / 2, y + boxH / 2 + 8, vertical ? 18 : 24, palette.bone, "middle"));
    if (index < labels.length - 1) {
      parts.push(`<path d="M ${x + boxW + 4} ${y + boxH / 2} h ${gap - 10}" stroke="${palette.amber}" stroke-width="4"/>`);
    }
  });
  const customersX = x0 + 2 * (boxW + gap) + boxW / 2;
  const youW = Math.min(vertical ? 460 : 520, boxW + 80);
  const youH = vertical ? 108 : 116;
  const youX = Math.max(36, Math.min(customersX - youW / 2, width - youW - 36));
  const youY = y + boxH + (vertical ? 120 : 100);
  parts.push(`<path d="M ${customersX} ${y + boxH} V ${youY}" fill="none" stroke="${palette.slate}" stroke-width="3"/>`);
  parts.push(data("service agreement", customersX - 16, y + boxH + 36, vertical ? 16 : 18, palette.slate, "end"));
  parts.push(`<rect x="${youX}" y="${youY}" width="${youW}" height="${youH}" rx="16" fill="none" stroke="${palette.teal}" stroke-width="3"/>`);
  parts.push(text("YOU", youX + youW / 2, youY + 46, 30, palette.bone, "middle"));
  parts.push(data("mid-size customer", youX + youW / 2, youY + 80, 18, palette.slate, "middle"));
  const itemW = Math.min(420, Math.max(240, youX - (vertical ? 56 : 90)));
  const itemX = youX - itemW - (vertical ? 20 : 36);
  const items = ["model", "fine-tuned weights", "data"];
  const itemH = 48 + items.length * 42;
  parts.push(`<rect x="${itemX}" y="${youY}" width="${itemW}" height="${itemH}" rx="16" fill="none" stroke="${palette.bone}" stroke-width="2"/>`);
  items.forEach((item, index) => {
    parts.push(text(item, itemX + 24, youY + 44 + index * 42, vertical ? 20 : 22, palette.bone, "start", 400));
  });
  return parts.join("");
}

function innerFor(beat: Beat, width: number, height: number, palette: ChannelPalette): { markup: string; bare: boolean } {
  const vertical = width < height;
  const quoted = beat.quotes.length ? beat.quotes : [beat.title];
  if (beat.kind === "url") {
    return {
      bare: true,
      markup: [
        text("sovereignshieldtechnologies.com", width / 2, height / 2, vertical ? 28 : 42, palette.bone, "middle"),
        `<line x1="${width / 2 - 280}" y1="${height / 2 + 16}" x2="${width / 2 + 280}" y2="${height / 2 + 16}" stroke="${palette.teal}" stroke-width="2"/>`,
      ].join(""),
    };
  }
  if (beat.kind === "gpu") {
    const lien = /lien/i.test(beat.body);
    return {
      bare: false,
      markup: [
        gpuIcon(width / 2 - 160, Math.round(height * 0.32), vertical ? 1.1 : 1.3, palette),
        text(lien ? "LIEN?" : "?", width / 2, Math.round(height * 0.68), lien ? 64 : 120, palette.amber, "middle"),
        text(lien ? "Full breakdown on the channel." : "Who owns the machine?", width / 2, Math.round(height * 0.76), 24, palette.bone, "middle", 400),
      ].join(""),
    };
  }
  if (beat.kind === "cds") return { bare: false, markup: cdsChart(width, height, palette) };
  if (beat.kind === "waffle") return { bare: false, markup: waffle(width, height, palette) };
  if (beat.kind === "stack") return { bare: false, markup: stacked(width, height, palette) };
  if (beat.kind === "bars") {
    const labels = quoted.filter((item) => item !== beat.title && /\d/.test(item));
    return { bare: false, markup: bars(width, height, labels.length ? labels : quoted, palette, beat.title) };
  }
  if (beat.kind === "table") return { bare: false, markup: table(width, height, quoted, palette, beat.title) };
  if (beat.kind === "stat") {
    const number = beat.body.match(/15\.78%|\$3\.5T|128|640|\$90B|\$31B/)?.[0] || quoted.find((item) => /\d/.test(item)) || beat.title;
    return {
      bare: false,
      markup: [
        text(number, width / 2, Math.round(height * 0.46), vertical ? 84 : 96, palette.amber, "middle"),
        block(lines(quoted[0] && quoted[0] !== number ? quoted[0] : beat.title, vertical ? 24 : 36, 3), width / 2, Math.round(height * 0.58), 28, palette.bone, "middle", 400),
      ].join(""),
    };
  }
  if (beat.kind === "quote" || beat.kind === "note") {
    const quote = quoted.find((item) => item.length > 40) || beat.body.replace(/^[^:]+:\s*/, "");
    const attribution = quoted.find((item) => /20\d\d|CNBC|CoreWeave|Musk|Gartner/.test(item) && item !== quote) || "";
    return { bare: false, markup: quoteCard(width, height, quote, attribution, palette, beat.kind === "quote") };
  }
  if (beat.kind === "list") {
    const reveal = beat.reveal ?? quoted.length;
    const items = quoted.slice(0, 3);
    const parts = [text("Before the next renewal", vertical ? 72 : 90, vertical ? 200 : 170, vertical ? 32 : 36, palette.bone, "start")];
    items.forEach((item, index) => {
      if (index + 1 > reveal) return;
      const y = (vertical ? 320 : 280) + index * (vertical ? 150 : 120);
      parts.push(text(clip(item, vertical ? 32 : 64), vertical ? 72 : 90, y, vertical ? 30 : 32, index + 1 === reveal ? palette.amber : palette.bone, "start"));
    });
    return { bare: false, markup: parts.join("") };
  }
  if (beat.kind === "ledger") return { bare: false, markup: ledger(width, height, palette) };
  if (beat.kind === "compare") return { bare: false, markup: compare(width, height, palette, beat.providerState ?? 0) };
  if (beat.kind === "steps") {
    return {
      bare: false,
      markup: [
        text("Node 1", width * 0.22, Math.round(height * 0.48), 32, palette.teal, "middle"),
        text("earns its place", width * 0.42, Math.round(height * 0.48), 20, palette.slate, "middle", 400),
        text("Node 2", width * 0.6, Math.round(height * 0.48), 32, palette.teal, "middle"),
        `<rect x="${width * 0.75}" y="${Math.round(height * 0.28)}" width="80" height="${Math.round(height * 0.28)}" fill="${palette.amber}"/>`,
        text("Neocloud: debt-funded buildout", width * 0.78, Math.round(height * 0.64), 16, palette.amber, "middle", 400),
      ].join(""),
    };
  }
  if (beat.kind === "loop") {
    const steps = ["NEW DEBT", "BUY GPUs", "RENT", "REPAY OLD DEBT"];
    return {
      bare: false,
      markup: [
        text("Refinancing machine", width / 2, 140, 32, palette.bone, "middle"),
        boxes(width, height, steps, palette, vertical),
        text("High-yield market on hold (CNBC credit desks, Oct 2026)", width / 2, Math.round(height * 0.74), 20, palette.amber, "middle", 400),
      ].join(""),
    };
  }
  if (beat.kind === "split") {
    return {
      bare: false,
      markup: [
        boxes(width, height, ["ACQUISITION", "PARTNERSHIP", "FAILURE"], palette, vertical),
        text("Compute doesn't vanish. It changes owners.", width / 2, Math.round(height * 0.72), 24, palette.bone, "middle", 400),
      ].join(""),
    };
  }
  if (beat.kind === "chain" && /service agreement|mid-size customer/i.test(beat.body)) {
    return { bare: false, markup: youChain(width, height, palette) };
  }
  if (beat.kind === "chain" || beat.kind === "flow") {
    const short = quoted.filter((item) => item !== beat.title);
    const labels = short.filter((item) => item.length < 42).slice(0, 3);
    const tags = short.filter((item) => !labels.includes(item));
    const fallback = beat.kind === "flow" ? ["LENDERS", "SPECIAL PURPOSE SUBSIDIARY", "GPU SERVERS"] : ["LENDERS", "NEOCLOUD", "BIG CUSTOMERS"];
    return { bare: false, markup: chain(width, height, labels.length ? labels : fallback, tags, palette, beat.title) };
  }
  return {
    bare: false,
    markup: block(lines(beat.title, vertical ? 16 : 24, 4), width / 2, Math.round(height * 0.4), 40, palette.bone, "middle"),
  };
}

export function drawBeatSvg(opts: {
  beat: Beat;
  aspect: Aspect;
  palette: ChannelPalette;
  channel: string;
  sceneIndex: number;
  sceneTotal: number;
}): string {
  const { width, height } = frameSize(opts.aspect);
  const drawn = innerFor(opts.beat, width, height, opts.palette);
  return frame(width, height, opts.palette, opts.channel, opts.sceneIndex, opts.sceneTotal, drawn.markup, opts.beat.source, drawn.bare);
}

export function drawBeatPng(svg: string, aspect: Aspect): Buffer {
  const { width } = frameSize(aspect);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: resvgFontConfig(),
  });
  return Buffer.from(resvg.render().asPng());
}
