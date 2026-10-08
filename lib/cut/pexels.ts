// Pexels stock photos. Used only when PEXELS_API_KEY is set; free key, and the
// Pexels license allows commercial use without attribution. We still keep the
// photographer credit and show it where photos are listed.
// API: https://www.pexels.com/api/documentation/

export type PexelsPhoto = {
  id: number;
  url: string; // page on pexels.com
  alt?: string;
  photographer?: string;
  photographer_url?: string;
  width?: number;
  height?: number;
  src?: { large?: string; large2x?: string; medium?: string; original?: string };
};

export type ProviderPhoto = {
  src: string;
  title: string;
  credit: string;
  attribution: string;
  provider: "pexels" | "wikimedia";
  text: string;
};

export function pexelsKey(): string {
  return (process.env.PEXELS_API_KEY ?? "").trim();
}

/** Turn one Pexels API photo into our shape. Null when it has no usable image. */
export function fromPexels(photo: PexelsPhoto): ProviderPhoto | null {
  const src = photo.src?.large || photo.src?.large2x || photo.src?.medium;
  if (!src) return null;
  const who = (photo.photographer ?? "").trim();
  const alt = (photo.alt ?? "").trim();
  return {
    src,
    title: alt || `Pexels photo ${photo.id}`,
    credit: photo.url || "https://www.pexels.com",
    attribution: who ? `Photo by ${who} on Pexels` : "Photo from Pexels",
    provider: "pexels",
    text: alt,
  };
}

export async function searchPexels(query: string, page: number, perPage = 20): Promise<ProviderPhoto[]> {
  const key = pexelsKey();
  if (!key) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${Math.max(1, page)}`;
  const response = await fetch(url, { headers: { Authorization: key } });
  if (!response.ok) {
    console.warn("pexels search", response.status, query);
    return [];
  }
  const data = (await response.json()) as { photos?: PexelsPhoto[] };
  return (data.photos ?? []).map(fromPexels).filter((p): p is ProviderPhoto => Boolean(p));
}
