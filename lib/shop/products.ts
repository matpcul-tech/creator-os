// TikTok Shop product research: parse best seller CSV exports (FastMoss, Kalodata, EchoTik,
// TikTok Creative Center Top Products) and rank products. Import only, no scraping.

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  commission: number; // percent
  unitsSold: number; // over the export window
  days: number; // export window in days
  velocity: number; // units per day
  growth: number; // percent change, 0 when unknown
  creators: number; // affiliates already promoting, 0 when unknown
  rating: number; // 0 when unknown
  url: string;
};

export type ScoredProduct = Product & {
  score: number;
  parts: { velocity: number; commission: number; price: number; competition: number };
  earnPerSale: number;
};

const ALIASES: Record<keyof Omit<Product, "id" | "velocity">, string[]> = {
  name: ["product name", "product", "name", "title", "product title", "item"],
  category: ["category", "categories", "niche", "industry"],
  price: ["price", "avg price", "average price", "unit price", "price (usd)", "price usd", "selling price"],
  commission: ["commission", "commission rate", "commission %", "commission rate (%)", "affiliate commission"],
  unitsSold: ["units sold", "sales", "sold", "sales volume", "items sold", "total sales", "7d sales", "sales (7d)", "28d sales", "sold count"],
  days: ["days", "period days", "window days", "date range days"],
  growth: ["growth", "sales growth", "growth rate", "change", "growth %"],
  creators: ["creators", "affiliates", "related creators", "creator count", "influencers", "videos"],
  rating: ["rating", "product rating", "stars", "review score"],
  url: ["url", "link", "product link", "product url"],
};

function norm(h: string): string {
  return h.toLowerCase().replace(/[\u2013\u2014_]/g, " ").replace(/\s+/g, " ").trim();
}

/** RFC 4180 style CSV parser (quotes, escaped quotes, commas and newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

/** "$1,234.50", "12.5%", "1.2k", "3.4M", "10-20" (takes the midpoint). */
export function num(raw: string | undefined): number {
  if (!raw) return 0;
  let s = raw.trim().toLowerCase().replace(/[$,%\s]/g, "").replace(/usd/g, "");
  const range = s.match(/^(\d*\.?\d+)([km]?)[-~](\d*\.?\d+)([km]?)$/);
  if (range) return (num(range[1] + (range[2] || range[4])) + num(range[3] + range[4])) / 2;
  let mult = 1;
  if (s.endsWith("k")) { mult = 1e3; s = s.slice(0, -1); }
  else if (s.endsWith("m")) { mult = 1e6; s = s.slice(0, -1); }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n * mult : 0;
}

export type ImportResult = { products: Product[]; missing: string[]; skipped: number };

export function importProducts(text: string, defaultDays = 7): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { products: [], missing: ["header and at least one row"], skipped: 0 };
  const header = rows[0].map(norm);
  const col: Partial<Record<keyof typeof ALIASES, number>> = {};
  for (const key of Object.keys(ALIASES) as (keyof typeof ALIASES)[]) {
    const idx = header.findIndex((h) => ALIASES[key].includes(h));
    if (idx >= 0) col[key] = idx;
  }
  const missing = (["name", "price", "unitsSold"] as const).filter((k) => col[k] === undefined).map(String);
  if (col.name === undefined) return { products: [], missing, skipped: rows.length - 1 };
  const products: Product[] = [];
  let skipped = 0;
  rows.slice(1).forEach((r, i) => {
    const get = (k: keyof typeof ALIASES) => (col[k] === undefined ? "" : (r[col[k]!] ?? "").trim());
    const name = get("name");
    if (!name) { skipped++; return; }
    let commission = num(get("commission"));
    if (commission > 0 && commission < 1) commission *= 100;
    const days = num(get("days")) || defaultDays;
    const unitsSold = num(get("unitsSold"));
    products.push({
      id: `${i}-${name.slice(0, 40)}`,
      name,
      category: get("category") || "Uncategorized",
      price: num(get("price")),
      commission,
      unitsSold,
      days,
      velocity: days > 0 ? unitsSold / days : 0,
      growth: num(get("growth")),
      creators: num(get("creators")),
      rating: num(get("rating")),
      url: get("url"),
    });
  });
  return { products, missing, skipped };
}

export type Weights = { velocity: number; commission: number; price: number; competition: number };
export const DEFAULT_WEIGHTS: Weights = { velocity: 40, commission: 25, price: 15, competition: 20 };

/** Price sweet spot for impulse buys on TikTok Shop: about $15 to $60. */
export function priceFit(price: number): number {
  if (price <= 0) return 0;
  if (price >= 15 && price <= 60) return 1;
  if (price < 15) return Math.max(0, price / 15) * 0.7;
  return Math.max(0, 1 - (price - 60) / 140);
}

export function scoreProducts(products: Product[], w: Weights = DEFAULT_WEIGHTS): ScoredProduct[] {
  const maxLogV = Math.max(1, ...products.map((p) => Math.log10(1 + p.velocity)));
  const total = Math.max(1, w.velocity + w.commission + w.price + w.competition);
  return products
    .map((p) => {
      const velocity = Math.log10(1 + p.velocity) / maxLogV;
      const commission = Math.min(1, p.commission / 25);
      const price = priceFit(p.price);
      // Fewer creators per daily sale means more room. Unknown creators counts as neutral.
      const competition = p.creators > 0 ? 1 / (1 + p.creators / Math.max(1, p.velocity)) : 0.5;
      const score =
        (100 * (velocity * w.velocity + commission * w.commission + price * w.price + competition * w.competition)) / total;
      return {
        ...p,
        score: Math.round(score * 10) / 10,
        parts: { velocity, commission, price, competition },
        earnPerSale: Math.round(p.price * p.commission) / 100,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export const SAMPLE_CSV_PATH = "/samples/tiktok-shop-example-products.csv";
