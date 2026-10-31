// Shared text cleanup. On screen copy and captions stay free of dash characters
// that the studio already rejects in scripts.

// Spoken text only. Dashes become a pause, arrows become the word "to".
export function speechText(text: string): string {
  return text
    .replace(/[→➡➔➜⇒]/g, " to ")
    .replace(/[\u2012\u2013\u2014\u2015]/g, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

export function plain(text: string): string {
  return text
    .replace(/[\u2012\u2013\u2014\u2015]/g, ", ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

export function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function clip(text: string, max: number): string {
  const clean = plain(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

export function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = plain(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > maxChars) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

export function wordCount(text: string): number {
  return plain(text).split(/\s+/).filter(Boolean).length;
}
