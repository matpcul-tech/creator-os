// Product video plan for TikTok Shop affiliate posts: hook, script lines, on-screen captions,
// spoken and on-screen FTC disclosure, and a post caption with hashtags.

export const DISCLOSURE = "I earn a commission from this link";
export const MAX_SECONDS = 59;
export const WORDS_PER_SECOND = 2.6;

export type ShopProductInput = { name: string; category?: string; price?: number; benefits?: string; audience?: string };
export type ShopScript = { hook: string; lines: string[]; cta: string; caption: string; hashtags: string[] };

/** Removes em and en dashes from copy (house style). */
export function noDashes(s: string): string {
  return s.replace(/\s*[\u2013\u2014]\s*/g, ", ").replace(/\s+,/g, ",");
}

export function cleanName(name: string): string {
  return name.replace(/^EXAMPLE DATA\s*[-:]\s*/i, "").trim();
}

function tag(s: string): string {
  return "#" + s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function hashtagsFor(p: ShopProductInput): string[] {
  const base = ["#tiktokshop", "#tiktokmademebuyit", "#founditontiktok", "#ad"];
  const extra = [p.category ? tag(p.category) : "", tag(cleanName(p.name).split(/\s+/).slice(-2).join(""))].filter((t) => t.length > 2);
  return Array.from(new Set([...base, ...extra])).slice(0, 7);
}

/** Template script used when AI is off or fails. Always ends with the spoken disclosure. */
export function templateScript(p: ShopProductInput): ShopScript {
  const name = cleanName(p.name);
  const benefits = (p.benefits || "")
    .split(/[\n.;]+/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 3);
  const hook = `I did not expect this ${name.toLowerCase()} to be this good.`;
  const lines = [
    `Here is the ${name} I have been using.`,
    ...(benefits.length ? benefits.map((b) => b.replace(/^./, (c) => c.toUpperCase()) + ".") : [
      "It does the one job it promises, and it does it fast.",
      "It feels solid in the hand, not cheap.",
    ]),
    p.price ? `It is about $${p.price.toFixed(2)} right now.` : "The price is lower than I expected.",
  ];
  const cta = "Tap the orange cart to check it out.";
  return finalize({ hook, lines, cta, caption: `${name}: real look before you buy.`, hashtags: hashtagsFor(p) });
}

/** Normalizes any script (AI or template): no dashes, disclosure present, fits under 60 s. */
export function finalize(s: ShopScript): ShopScript {
  const clean = (x: string) => noDashes(x).trim();
  let lines = s.lines.map(clean).filter(Boolean);
  const hook = clean(s.hook);
  const cta = clean(s.cta);
  // Trim body lines until the spoken total fits.
  while (lines.length > 1 && spokenSeconds({ ...s, hook, lines, cta }) > MAX_SECONDS - 2) lines = lines.slice(0, -1);
  const hashtags = Array.from(new Set(s.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h).replace(/\s+/g, ""))));
  if (!hashtags.includes("#ad")) hashtags.push("#ad");
  return { hook, lines, cta, caption: clean(s.caption), hashtags };
}

/** Spoken segments in order. The disclosure is always the last line spoken. */
export function spokenSegments(s: ShopScript): string[] {
  return [s.hook, ...s.lines, s.cta, `${DISCLOSURE}.`];
}

export function spokenSeconds(s: ShopScript): number {
  const words = spokenSegments(s).join(" ").split(/\s+/).filter(Boolean).length;
  return words / WORDS_PER_SECOND + 1;
}

export function postCaption(s: ShopScript): string {
  return noDashes(`${s.caption} ${DISCLOSURE}. ${s.hashtags.join(" ")}`).trim();
}

/** Splits total time across segments by word count. */
export function segmentTimes(segments: string[], total: number): { start: number; end: number }[] {
  const weights = segments.map((t) => Math.max(1, t.split(/\s+/).filter(Boolean).length));
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = 0;
  return weights.map((w) => {
    const start = t;
    t += (w / sum) * total;
    return { start, end: t };
  });
}
