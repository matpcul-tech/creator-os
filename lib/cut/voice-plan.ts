// Pure planning for long voiceovers: which scenes go in which request, and where every scene's
// narration sits on the joined track. Runs in the browser and in node tests.

/** Characters per voice request. The server takes up to 2000, so this leaves room. */
export const VOICE_BATCH_CHARS = 1200;
export const VOICE_BATCH_SEGMENTS = 40;
/** Silence between audio pieces inside one scene, and between scenes. */
export const PIECE_GAP = 0.06;
export const SCENE_GAP = 0.22;

/**
 * Splits scene texts into requests of whole scenes, in order. A scene is never split across
 * requests, and every scene is in exactly one request.
 */
export function voiceBatches(segments: string[], maxChars = VOICE_BATCH_CHARS, maxSegments = VOICE_BATCH_SEGMENTS): number[][] {
  const batches: number[][] = [];
  let current: number[] = [];
  let chars = 0;
  segments.forEach((segment, index) => {
    const size = segment.length + 1;
    if (current.length && (chars + size > maxChars || current.length >= maxSegments)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(index);
    chars += size;
  });
  if (current.length) batches.push(current);
  return batches;
}

export type Span = { start: number; end: number };

/**
 * Lays audio pieces end to end. `counts[i]` pieces belong to segment i. Returns where each piece
 * starts, each segment's narration span, and the total length, all in seconds.
 */
export function layoutParts(
  partSeconds: number[],
  counts: number[],
  gaps: { piece?: number; scene?: number } = {},
): { partStarts: number[]; spans: Span[]; total: number } {
  const pieceGap = gaps.piece ?? PIECE_GAP;
  const sceneGap = gaps.scene ?? SCENE_GAP;
  const partStarts: number[] = [];
  const spans: Span[] = [];
  let time = 0;
  let part = 0;
  counts.forEach((count, segment) => {
    if (segment > 0) time += sceneGap;
    const start = time;
    for (let k = 0; k < count; k++) {
      if (k > 0) time += pieceGap;
      partStarts.push(time);
      time += partSeconds[part] ?? 0;
      part += 1;
    }
    spans.push({ start, end: time });
  });
  return { partStarts, spans, total: time };
}

/** Plain words for the voice limit check. Empty when the limit has room for the whole script. */
export function voiceLimitNote(requests: number, left: number | null, limit: number): string {
  if (left === null || left >= requests) return "";
  return `This script needs ${requests} voice requests and today's voice limit has ${left} of ${limit} left. Nothing was voiced, so no line is skipped. The limit resets at midnight UTC, or try a shorter script.`;
}
