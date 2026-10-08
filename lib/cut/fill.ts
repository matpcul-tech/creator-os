// Planning for scenes whose photo is missing after every search, so nothing repeats later in a video.

export type Gap<S extends string> = { kind: "photo" } | { kind: "still"; id: S } | { kind: "carry"; from: number };

/**
 * Scenes with a photo keep it. Each missing scene takes a built-in still that has not been used
 * yet (its preferred one first). When every still is used, the scene holds the previous scene's
 * picture, which reads as one longer shot instead of a repeat later in the video.
 */
export function planGaps<S extends string>(hasPhoto: boolean[], preferred: (S | undefined)[], ids: S[]): Gap<S>[] {
  const free = new Set(ids);
  return hasPhoto.map((has, index) => {
    if (has) return { kind: "photo" } as const;
    const want = preferred[index];
    const id = want && free.has(want) ? want : [...free][0];
    if (id !== undefined) {
      free.delete(id);
      return { kind: "still", id } as const;
    }
    return { kind: "carry", from: Math.max(0, index - 1) } as const;
  });
}

/** Tracks every photo (src and near duplicate key) a video uses, so a photo is never placed twice. */
export class PhotoLedger {
  private used = new Set<string>();
  constructor(seed: Iterable<string> = []) {
    for (const key of seed) this.used.add(key);
  }
  free(item: { src: string; key?: string }): boolean {
    return !this.used.has(item.src) && !(item.key && this.used.has(item.key));
  }
  /** Claims the photo if it is free. Claiming is synchronous, so parallel loads never pick the same one. */
  claim(item: { src: string; key?: string }): boolean {
    if (!this.free(item)) return false;
    this.used.add(item.src);
    if (item.key) this.used.add(item.key);
    return true;
  }
  release(item: { src: string; key?: string }): void {
    this.used.delete(item.src);
    if (item.key) this.used.delete(item.key);
  }
  list(): string[] {
    return [...this.used];
  }
}

// Image hosts rate limit bursts, so photos load a few at a time.
export async function inBatches<T>(items: T[], size: number, run: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await run(items[index], index);
      }
    }),
  );
}
