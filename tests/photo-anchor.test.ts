import test from "node:test";
import assert from "node:assert/strict";
import { anchorQueries, isVague, keepQuery, subjectOf, topicQueries } from "../lib/cut/anchor";
import { mentions, pickPhotos, stockSiteScore } from "../lib/cut/clips";
import { planGaps } from "../lib/cut/fill";
import { placePhotos, type PlaceItem } from "../lib/cut/place-photos";
import { fallbackQueries } from "../lib/cut/visual-queries";

delete process.env.PEXELS_API_KEY;
delete process.env.PIXABAY_API_KEY;

const TITLE = "5 wearables longevity scientists actually use themselves";
const LINES = [
  "Number one is the Oura Ring.",
  "And the Oura Ring gives you a window into your recovery that your phone never could.",
  "Most people are shocked by what they find.",
  "So does a single glass of wine.",
  "Number two is WHOOP.",
  "You can see it.",
  "Number three is a continuous glucose monitor.",
  "That one habit is worth more than most supplements.",
  "Number four is a Garmin watch.",
  "Number five is the Eight Sleep pod.",
  "Here is the catch.",
  "They only show you what is already happening.",
  "They do not chase every score.",
  "They look for trends over weeks, not single days.",
  "Tell me in the comments.",
  "Follow for more on the science of living longer.",
  "Which of these would you try first?",
  "And they ignore the noise.",
];

test("product names are concrete subjects", () => {
  assert.equal(subjectOf("Number one is the Oura Ring.")?.name, "Oura Ring");
  assert.equal(subjectOf("WHOOP has no screen")?.name, "WHOOP");
  assert.equal(subjectOf("A CGM on your arm")?.name, "CGM");
  assert.equal(subjectOf("a Garmin watch")?.name, "Garmin");
  assert.equal(subjectOf("the Eight Sleep pod")?.name, "Eight Sleep");
  assert.equal(subjectOf("Most people are shocked by what they find."), null);
  assert.equal(isVague("Most people are shocked by what they find."), true);
  assert.equal(isVague("So does a single glass of wine."), false, "food lines are about the food");
});

test("vague lines inherit the current subject, then the topic, instead of literal keywords", () => {
  const sq = anchorQueries(LINES, TITLE, fallbackQueries(LINES, TITLE));
  const oura = subjectOf("Oura")!.queries;
  assert.equal(sq.scenes[0][0], oura[0]);
  assert.ok(oura.includes(sq.scenes[2][0]), `shocked line follows the Oura Ring: ${sq.scenes[2]}`);
  assert.ok(sq.scenes[2].every((q) => !/shocked|find/.test(q)));
  assert.ok(subjectOf("WHOOP")!.queries.includes(sq.scenes[5][0]), "a vague line after WHOOP shows WHOOP");
  assert.ok(sq.scenes[3].some((q) => /wine/.test(q)), "the wine line keeps its own picture");
  // Far from any subject, the topic (wearables) anchors the line.
  const topic = topicQueries(TITLE);
  assert.ok(topic.length > 0 && topic.every((q) => !q.endsWith("photograph")));
  assert.ok(topic.includes(sq.scenes[17][0]), `late vague line uses the topic: ${sq.scenes[17]}`);
  for (const list of sq.scenes) assert.ok(list.length >= 1 && list.length <= 3);
});

test("people, children and food queries only stay when the line is about them", () => {
  assert.equal(keepQuery("shocked woman face", "Most people are shocked by what they find."), true, "the line mentions people");
  assert.equal(keepQuery("shocked woman face", "That feedback loop is the whole point."), false);
  assert.equal(keepQuery("happy child playing", "Sleep touches every number."), false);
  assert.equal(keepQuery("fried chicken plate", "Garmin tracks your training load."), false);
  assert.equal(keepQuery("oatmeal bowl", "Oatmeal can spike you more than steak."), true);
});

test("model written queries are kept as the line's own picture", () => {
  const sq = anchorQueries(["Most of us sleep too warm."], TITLE, { scenes: [["bedroom thermostat"]], topic: ["smartwatch on wrist"] }, true);
  assert.equal(sq.scenes[0][0], "bedroom thermostat");
});

test("query words match at the start of a word, so ring never matches breading", () => {
  assert.equal(mentions("fried, breaded, food", "ring"), false);
  assert.equal(mentions("finger rings, hand", "ring"), true);
  assert.equal(mentions("open notebook", "pen"), false);
});

test("wedding jewelry is dropped for a ring search and food photos rank below on topic photos", () => {
  assert.equal(stockSiteScore("pixabay", "wedding rings, hand, marriage", "ring hand"), null);
  assert.notEqual(stockSiteScore("pixabay", "hand, ring, finger", "ring hand"), null);
  const plain = stockSiteScore("pixabay", "smartwatch, wrist, technology", "smartwatch wrist")!;
  const food = stockSiteScore("pixabay", "pizza, smartwatch, wrist", "smartwatch wrist")!;
  assert.ok(food < plain);
});

test("built-in stills are used once each, then a scene holds the previous picture", () => {
  const gaps = planGaps([true, false, false, false, true, false], ["desk", "desk", "desk", undefined, undefined, "desk"], ["desk", "city"]);
  assert.deepEqual(gaps, [
    { kind: "photo" },
    { kind: "still", id: "desk" },
    { kind: "still", id: "city" },
    { kind: "carry", from: 2 },
    { kind: "photo" },
    { kind: "carry", from: 4 },
  ]);
});

function mockFetch(handler: (url: string) => unknown) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    return new Response(JSON.stringify(handler(url)), { status: 200 });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

test("no photo repeats across a 60 scene video, even when queries overlap heavily", async () => {
  process.env.PIXABAY_API_KEY = "x";
  const stamp = Date.now();
  // Every query returns the same 50 photos per page, so overlap is maximal.
  const m = mockFetch((url) => {
    if (!url.includes("pixabay.com/api")) return { query: { pages: {} } };
    const page = Number(new URL(url).searchParams.get("page") ?? "1");
    return {
      hits: Array.from({ length: 50 }, (_, i) => ({
        id: page * 1000 + i,
        type: "photo",
        pageURL: `https://pixabay.com/photos/p-${page}-${i}/`,
        tags: `smartwatch, wrist, fitness tracker, ring, hand, glucose monitor, bedroom, night, mattress, bed, treadmill, running, heart rate monitor, ${stamp}`,
        largeImageURL: `https://pixabay.com/get/${stamp}_${page}_${i}_1280.jpg`,
        user: `user${i}`,
      })),
    };
  });
  try {
    const lines = Array.from({ length: 60 }, (_, i) => LINES[i % LINES.length]);
    const r = await pickPhotos({ lines, topic: `${TITLE} ${stamp}`, extra: 20 });
    const picked = r.picks.filter(Boolean).map((p) => p!.src);
    assert.equal(new Set(picked).size, picked.length, "no repeated photo");
    assert.equal(new Set(r.picks.filter(Boolean).map((p) => p!.key)).size, picked.length, "no repeated near duplicate");
    assert.ok(r.pool.every((p) => !picked.includes(p.src)), "spares never repeat a pick");
    assert.ok(picked.length >= 50, `most scenes get a photo (${picked.length})`);
  } finally {
    m.restore();
    delete process.env.PIXABAY_API_KEY;
  }
});

test("the browser placement never repeats a photo when loads fail, and searches deeper for the rest", async () => {
  const item = (id: string, key?: string): PlaceItem => ({ src: id, url: `/u/${id}`, key });
  const bodies: Record<string, unknown>[] = [];
  const fetchItems = async (body: Record<string, unknown>) => {
    bodies.push(body);
    if (bodies.length === 1) {
      return {
        items: [item("a"), item("b"), item("bad1"), item("bad2"), item("a")],
        pool: [item("b"), item("c", "shoot1"), item("d", "shoot1"), item("bad3")],
        queries: { scenes: [["q1"], ["q2"], ["q3"], ["q4"], ["q5"]], topic: ["t"] },
      };
    }
    return { items: [item("e"), item("f")], pool: [item("a"), item("g")] };
  };
  const loads: string[] = [];
  const load = async (url: string) => {
    loads.push(url);
    return !url.includes("bad");
  };
  const { picks, rounds } = await placePhotos({ lines: ["1", "2", "3", "4", "5"], topic: "t", fetchItems, load, retryDelayMs: 1 });
  const srcs = picks.map((p) => p?.src ?? null);
  assert.equal(new Set(srcs.filter(Boolean)).size, srcs.filter(Boolean).length, `no repeats: ${srcs}`);
  assert.ok(!(srcs.includes("c") && srcs.includes("d")), "near duplicates of one shoot count once");
  assert.equal(rounds, 2, "missing scenes trigger a deeper search");
  assert.equal(bodies[1].offset, 50);
  assert.ok((bodies[1].exclude as string[]).includes("a"), "the deeper search excludes photos already used");
  assert.ok(srcs.every(Boolean), `every scene ends with a photo: ${srcs}`);
  assert.equal(loads.filter((u) => u === "/u/bad1").length, 2, "a failed photo is retried once");
});
