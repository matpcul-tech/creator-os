// Friendly photo credits for cards and thumbnails: the photographer and the
// source, never a raw ID or file number.

export function creditFor(item: { provider?: string; attribution?: string; title: string }): string {
  if (item.provider && item.provider !== "wikimedia") {
    return item.attribution || (item.provider === "pixabay" ? "Image from Pixabay" : "Photo from Pexels");
  }
  const name = item.title
    .replace(/^File:/i, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/_/g, " ")
    .replace(/\s*\(\d{6,}\)\s*$/, "")
    .trim();
  return name ? `${name}, Wikimedia Commons` : "Wikimedia Commons";
}

/** True when a photo's tags or title mention a word from the card's search queries. */
export function fitsCard(item: { text?: string; title: string }, queries: string[]): boolean {
  const words = [...new Set(queries.join(" ").toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3))].map((w) => w.replace(/(ing|ers|er|ed|es|s)$/, ""));
  if (!words.length) return true;
  const hay = `${item.text ?? ""} ${item.title}`.toLowerCase();
  return words.some((w) => hay.includes(w));
}

