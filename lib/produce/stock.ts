// Optional Pixabay still, used only when a scene visual starts with "stock:"
// and PIXABAY_API_KEY is set. A miss falls back to the branded card.

import { searchPixabay } from "@/lib/cut/pixabay";

const MAX_BYTES = 1_800_000;

export async function stockPlate(query: string): Promise<{ href: string; credit: string } | null> {
  const q = query.trim();
  if (!q) return null;
  let photos;
  try {
    photos = await searchPixabay(q, 1, 5);
  } catch {
    return null;
  }
  const photo = photos[0];
  if (!photo?.src) return null;
  try {
    const response = await fetch(photo.src, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!type.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) return null;
    return {
      href: `data:${type};base64,${bytes.toString("base64")}`,
      credit: photo.attribution || "Image from Pixabay",
    };
  } catch {
    return null;
  }
}
