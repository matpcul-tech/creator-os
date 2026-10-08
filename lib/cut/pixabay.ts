// Pixabay stock photos. Used only when PIXABAY_API_KEY is set. Free key; the
// Pixabay Content License allows commercial use. Per the API terms we cache
// every search for 24 hours, only display returned URLs temporarily (through
// our proxy, then rendered into the user's own file), and show where each
// photo came from. Docs: https://pixabay.com/api/docs/

import type { ProviderPhoto } from "./pexels";

export type PixabayHit = {
  id: number;
  pageURL?: string;
  type?: string;
  tags?: string;
  webformatURL?: string;
  largeImageURL?: string;
  imageWidth?: number;
  imageHeight?: number;
  user?: string;
  user_id?: number;
};

export function pixabayKey(): string {
  return (process.env.PIXABAY_API_KEY ?? "").trim();
}

/** Turn one Pixabay hit into our shape. Null for non photos or hits with no image. */
export function fromPixabay(hit: PixabayHit): ProviderPhoto | null {
  if (hit.type && hit.type !== "photo") return null;
  const src = hit.largeImageURL || hit.webformatURL;
  if (!src) return null;
  const who = (hit.user ?? "").trim();
  const tags = (hit.tags ?? "").trim();
  return {
    src,
    title: tags ? `${tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3).join(", ")} (Pixabay ${hit.id})` : `Pixabay photo ${hit.id}`,
    credit: hit.pageURL || "https://pixabay.com",
    attribution: who ? `Image by ${who} from Pixabay` : "Image from Pixabay",
    provider: "pixabay",
    text: tags,
  };
}

export function pixabayUrl(key: string, query: string, page: number, perPage: number): string {
  const params = new URLSearchParams({
    key,
    q: query.slice(0, 100),
    image_type: "photo",
    safesearch: "true",
    per_page: String(Math.max(3, Math.min(200, perPage))),
    page: String(Math.max(1, page)),
  });
  return `https://pixabay.com/api/?${params.toString()}`;
}

export async function searchPixabay(query: string, page: number, perPage = 30): Promise<ProviderPhoto[]> {
  const key = pixabayKey();
  if (!key) return [];
  // The key rides in the URL, so the URL is never logged.
  const response = await fetch(pixabayUrl(key, query, page, perPage));
  if (!response.ok) {
    console.warn("pixabay search", response.status, query);
    return [];
  }
  const data = (await response.json()) as { hits?: PixabayHit[] };
  return (data.hits ?? []).map(fromPixabay).filter((p): p is ProviderPhoto => Boolean(p));
}
