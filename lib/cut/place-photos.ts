// Places one photo per scene for a whole video with no repeats: loads a few at a time, retries a
// busy image once, falls back to unused spares, then asks the server once more (deeper results,
// excluding everything already used) for the scenes still empty. Fetch and load are passed in, so
// this runs in the browser and in tests.

import { inBatches, PhotoLedger } from "./fill";

export type PlaceItem = { src: string; url: string; key?: string };
export type PlaceResponse<I extends PlaceItem> = { items?: (I | null)[]; pool?: I[]; queries?: { scenes: string[][]; topic: string[] } };

export async function placePhotos<I extends PlaceItem>(opts: {
  lines: string[];
  topic: string;
  fetchItems: (body: Record<string, unknown>) => Promise<PlaceResponse<I>>;
  load: (url: string) => Promise<boolean>;
  /** Photos already shown elsewhere that must not be used. */
  exclude?: string[];
  retryDelayMs?: number;
  concurrency?: number;
}): Promise<{ picks: (I | null)[]; used: string[]; rounds: number }> {
  const ledger = new PhotoLedger(opts.exclude ?? []);
  const picks: (I | null)[] = opts.lines.map(() => null);
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const fill = async (indexes: number[], items: (I | null)[], pool: I[]) => {
    const spares = pool.slice();
    await inBatches(indexes, opts.concurrency ?? 3, async (sceneIndex, k) => {
      const own = items[k];
      if (own && ledger.claim(own)) {
        if ((await opts.load(own.url)) || (await wait(opts.retryDelayMs ?? 1000).then(() => opts.load(own.url)))) {
          picks[sceneIndex] = own;
          return;
        }
      }
      // A spare is claimed before it loads, so two scenes never take the same one.
      for (let at = spares.findIndex((s) => ledger.free(s)); at >= 0; at = spares.findIndex((s) => ledger.free(s))) {
        const spare = spares.splice(at, 1)[0];
        ledger.claim(spare);
        if (await opts.load(spare.url)) {
          picks[sceneIndex] = spare;
          return;
        }
      }
    });
  };

  const all = opts.lines.map((_, i) => i);
  const first = await opts.fetchItems({ lines: opts.lines, topic: opts.topic, exclude: ledger.list().slice(-400), extra: Math.min(40, opts.lines.length) }).catch(
    () => ({}) as PlaceResponse<I>,
  );
  await fill(all, first.items ?? [], first.pool ?? []);
  let rounds = 1;

  const missing = all.filter((i) => !picks[i]);
  if (missing.length) {
    rounds = 2;
    const queries = first.queries && first.queries.scenes.length === opts.lines.length
      ? { scenes: missing.map((i) => first.queries!.scenes[i]), topic: first.queries.topic }
      : undefined;
    const second = await opts
      .fetchItems({
        lines: missing.map((i) => opts.lines[i]),
        topic: opts.topic,
        exclude: ledger.list().slice(-500),
        offset: 50,
        extra: Math.min(40, missing.length * 2),
        ...(queries ? { queries } : {}),
      })
      .catch(() => ({}) as PlaceResponse<I>);
    await fill(missing, second.items ?? [], second.pool ?? []);
  }
  return { picks, used: ledger.list(), rounds };
}
