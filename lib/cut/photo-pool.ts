// Pure photo assignment so no photo repeats across the scenes of one video.

export type Candidate = { src: string; key?: string };

const keysOf = (item: Candidate) => (item.key ? [item.src, item.key] : [item.src]);

/**
 * Give each scene its best candidate that has not been used yet.
 * 1. Each scene takes its own best unused candidate, in scene order.
 * 2. Scenes left empty take unused photos from the shared fallback pool (the topic).
 * 3. Only when every pool is used up are photos reused, round robin, never
 *    the same photo on two scenes in a row.
 * Anything in `exclude` (photos already shown) is never picked in steps 1 and 2.
 * Near duplicates share a `key` (same object or photo series) and count as used together.
 */
export function assignUnique<T extends Candidate>(
  perScene: T[][],
  fallback: T[] | ((index: number) => T[]) = [],
  exclude: Iterable<string> = [],
): (T | null)[] {
  const used = new Set(exclude);
  const out: (T | null)[] = perScene.map(() => null);

  perScene.forEach((list, index) => {
    const pick = list.find((item) => keysOf(item).every((k) => !used.has(k)));
    if (pick) {
      out[index] = pick;
      keysOf(pick).forEach((k) => used.add(k));
    }
  });

  // A function gives each scene its own (already relevance checked) spare pool.
  const shared =
    typeof fallback === "function"
      ? null
      : [...fallback, ...perScene.flat()].filter((item, i, all) => all.findIndex((x) => x.src === item.src) === i);
  out.forEach((value, index) => {
    if (value) return;
    const spare = shared ?? (fallback as (index: number) => T[])(index);
    const pick = spare.find((item) => keysOf(item).every((k) => !used.has(k)));
    if (pick) {
      out[index] = pick;
      keysOf(pick).forEach((k) => used.add(k));
    }
  });

  // Truly exhausted: reuse what this video already has, spread out.
  const assigned = out.filter((item): item is T => Boolean(item));
  if (assigned.length > 1) {
    let turn = 0;
    out.forEach((value, index) => {
      if (value) return;
      for (let tries = 0; tries < assigned.length; tries++) {
        const pick = assigned[(turn + tries) % assigned.length];
        const prev = out[index - 1];
        const next = out[index + 1];
        if (pick.src !== prev?.src && pick.src !== next?.src) {
          out[index] = pick;
          turn = (turn + tries + 1) % assigned.length;
          break;
        }
      }
    });
  }
  return out;
}

/** Built-in stills, spread evenly: best keyword match among the least used, never twice in a row. */
export function spreadStills<S extends string>(scores: Record<S, number>[], ids: S[]): S[] {
  const count = new Map<S, number>(ids.map((id) => [id, 0]));
  const out: S[] = [];
  scores.forEach((score, index) => {
    const prev = out[index - 1];
    const ranked = ids
      .filter((id) => id !== prev)
      .sort((a, b) => (count.get(a)! - count.get(b)!) || (score[b] ?? 0) - (score[a] ?? 0));
    const pick = ranked[0] ?? ids[0];
    count.set(pick, (count.get(pick) ?? 0) + 1);
    out.push(pick);
  });
  return out;
}

/**
 * A key shared by near duplicates: the same object or Flickr series uploaded
 * as several files. Drops the File: prefix, extension, numbers, IDs, and
 * copyright tails. Titles that are only a camera code (DSC 0042) keep their
 * own key so different photos are not merged.
 */
export function photoKey(title: string, src: string): string {
  const base = title
    .replace(/^File:/i, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\bcopyright\b.*$/i, "")
    .replace(/\([^)]*\d[^)]*\)/g, " ")
    .replace(/[_\-.,;:()[\]'"]+/g, " ")
    .replace(/\d+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const words = base.split(" ").filter((w) => w.length >= 3 && !/^(img|dsc|dscn|dscf|pxl|photo|image|file|jpg|jpeg)$/.test(w));
  return words.length >= 2 ? `t:${words.join(" ")}` : `u:${src}`;
}
