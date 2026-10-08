// Places one photo per scene for a whole video with no repeats, however long the script is. Scenes
// go to the server in batches (so every request stays small and inside its time limit), and each
// batch excludes every photo already used. Photos load a few at a time, a busy image is retried
// once, failed loads fall back to unused spares, then one deeper search runs for that batch's
// empty scenes. Fetch and load are passed in, so this runs in the browser and in tests.

import { inBatches, PhotoLedger } from "./fill";

export type PlaceItem = { src: string; url: string; key?: string };
export type PlaceQueries = { scenes: string[][]; topic: string[] };
export type PlaceResponse<I extends PlaceItem> = { items?: (I | null)[]; pool?: I[]; queries?: PlaceQueries };

/** Scenes per photo request. The server takes up to 60; smaller batches answer well inside its timeout. */
export const PHOTO_BATCH = 24;
/** Lines before a batch that are sent along so topic anchoring carries across batch edges. */
const CONTEXT_LINES = 6;
/** How much of the used list goes with each request. The browser ledger is the real no-repeat check. */
const EXCLUDE_MAX = 1600;

export async function placePhotos<I extends PlaceItem>(opts: {
  lines: string[];
  topic: string;
  fetchItems: (body: Record<string, unknown>) => Promise<PlaceResponse<I>>;
  load: (url: string) => Promise<boolean>;
  /** Photos already shown elsewhere that must not be used. */
  exclude?: string[];
  /** Search queries from an earlier run for the same lines, so the AI step is skipped. */
  queries?: PlaceQueries;
  /** Optional check that a spare fits a scene before it is used there. */
  fits?: (item: I, sceneIndex: number) => boolean;
  /** Called as soon as a scene's photo has loaded. */
  onPick?: (sceneIndex: number, item: I) => void;
  /** Called after each batch with how many scenes are done. */
  onProgress?: (done: number, total: number) => void;
  retryDelayMs?: number;
  concurrency?: number;
  batchSize?: number;
}): Promise<{ picks: (I | null)[]; used: string[]; rounds: number; requests: number; queries?: PlaceQueries }> {
  const ledger = new PhotoLedger(opts.exclude ?? []);
  const picks: (I | null)[] = opts.lines.map(() => null);
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const size = Math.max(1, Math.min(60, opts.batchSize ?? PHOTO_BATCH));
  const known = opts.queries && opts.queries.scenes.length === opts.lines.length ? opts.queries : undefined;
  const sceneQueries: (string[] | null)[] = opts.lines.map((_, i) => known?.scenes[i] ?? null);
  let topicQueries: string[] = known?.topic ?? [];
  let rounds = 1;
  let requests = 0;

  const pick = (sceneIndex: number, item: I) => {
    picks[sceneIndex] = item;
    opts.onPick?.(sceneIndex, item);
  };

  const fill = async (indexes: number[], items: (I | null)[], pool: I[], strict: boolean) => {
    const spares = pool.slice();
    const usable = (spare: I, sceneIndex: number) => ledger.free(spare) && (!strict || !opts.fits || opts.fits(spare, sceneIndex));
    await inBatches(indexes, opts.concurrency ?? 3, async (sceneIndex, k) => {
      const own = items[k];
      if (own && ledger.claim(own)) {
        if ((await opts.load(own.url)) || (await wait(opts.retryDelayMs ?? 1000).then(() => opts.load(own.url)))) {
          pick(sceneIndex, own);
          return;
        }
      }
      // A spare is claimed before it loads, so two scenes never take the same one.
      for (let at = spares.findIndex((s) => usable(s, sceneIndex)); at >= 0; at = spares.findIndex((s) => usable(s, sceneIndex))) {
        const spare = spares.splice(at, 1)[0];
        ledger.claim(spare);
        if (await opts.load(spare.url)) {
          pick(sceneIndex, spare);
          return;
        }
      }
    });
  };

  const ask = (body: Record<string, unknown>) => {
    requests += 1;
    return opts.fetchItems(body).catch(() => ({}) as PlaceResponse<I>);
  };

  for (let from = 0; from < opts.lines.length; from += size) {
    const indexes = opts.lines.slice(from, from + size).map((_, k) => from + k);
    const lines = indexes.map((i) => opts.lines[i]);
    const context = opts.lines.slice(Math.max(0, from - CONTEXT_LINES), from);
    const given = indexes.every((i) => sceneQueries[i]) ? { scenes: indexes.map((i) => sceneQueries[i]!), topic: topicQueries } : undefined;
    const first = await ask({
      lines,
      topic: opts.topic,
      context,
      exclude: ledger.list().slice(-EXCLUDE_MAX),
      extra: Math.min(40, lines.length),
      ...(given ? { queries: given } : {}),
    });
    if (first.queries && first.queries.scenes.length === lines.length) {
      first.queries.scenes.forEach((list, k) => (sceneQueries[indexes[k]] = list));
      if (!topicQueries.length) topicQueries = first.queries.topic;
    }
    await fill(indexes, first.items ?? [], first.pool ?? [], true);

    const missing = indexes.filter((i) => !picks[i]);
    if (missing.length) {
      rounds = 2;
      const queries = missing.every((i) => sceneQueries[i]) ? { scenes: missing.map((i) => sceneQueries[i]!), topic: topicQueries } : undefined;
      const second = await ask({
        lines: missing.map((i) => opts.lines[i]),
        topic: opts.topic,
        context,
        exclude: ledger.list().slice(-EXCLUDE_MAX),
        offset: 50,
        extra: Math.min(40, missing.length * 2),
        ...(queries ? { queries } : {}),
      });
      await fill(missing, second.items ?? [], second.pool ?? [], false);
    }
    opts.onProgress?.(Math.min(opts.lines.length, from + size), opts.lines.length);
  }
  const queries = sceneQueries.every(Boolean) ? { scenes: sceneQueries as string[][], topic: topicQueries } : undefined;
  return { picks, used: ledger.list(), rounds, requests, queries };
}
