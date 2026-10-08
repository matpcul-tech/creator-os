import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanQuery, parseQueries, sanitizeQueries, visualQueries } from "../lib/cut/visual-queries";
import { assignUnique, photoKey } from "../lib/cut/photo-pool";
import { isSceneStock, stockScore } from "../lib/cut/photo-filter";
import { fromPexels, searchPexels } from "../lib/cut/pexels";
import { allowedImage, pickPhotos, scoreFor } from "../lib/cut/clips";
import { supportsEffort } from "../lib/ai-budget";

const lines = ["Sleep is the first lever.", "Muscle is the second."];

test("AI queries are parsed, cleaned, and capped at three per scene", () => {
  const text = 'Sure: {"scenes": [["person sleeping in bed", "bedroom at night"], ["weightlifting gym", "strong arm \u2013 dumbbell", "a", "x", "y"]], "topic": ["healthy senior couple"]}';
  const q = parseQueries(text, lines, "");
  assert.deepEqual(q.scenes[0], ["person sleeping in bed", "bedroom at night"]);
  assert.equal(q.scenes[1].length, 2); // "a" is too short, the rest trimmed
  assert.equal(q.scenes[1][1], "strong arm dumbbell");
  assert.deepEqual(q.topic, ["healthy senior couple"]);
  assert.equal(cleanQuery("Cold\u2014water swim!"), "cold water swim");
});

test("a garbled answer falls back to keyword queries for every scene", () => {
  const q = parseQueries("not json", lines, "Longevity science");
  assert.equal(q.scenes.length, 2);
  assert.ok(q.scenes.every((list) => list.length > 0));
  assert.ok(q.topic.length > 0);
});

test("queries sent back by the browser must match the script", () => {
  assert.equal(sanitizeQueries({ scenes: [["a b c"]], topic: [] }, lines), null);
  const ok = sanitizeQueries({ scenes: [["person sleeping"], ["gym"]], topic: ["x y z"] }, lines);
  assert.deepEqual(ok?.scenes, [["person sleeping"], ["gym"]]);
});

test("the AI is asked once per script, then cached; failures use keywords", async () => {
  let calls = 0;
  const ask = async () => {
    calls++;
    return '{"scenes": [["person sleeping in bed"], ["weightlifting gym"]], "topic": []}';
  };
  const script = [`Unique line ${Date.now()}.`, "Muscle is the second."];
  const a = await visualQueries(script, "", ask);
  const b = await visualQueries(script, "", ask);
  assert.equal(calls, 1);
  assert.equal(a.source, "ai");
  assert.equal(b.source, "cache");
  const failed = await visualQueries([`Other ${Date.now()}.`], "", async () => {
    throw new Error("limit reached");
  });
  assert.equal(failed.source, "keywords");
  assert.ok(failed.scenes[0].length > 0);
});

test("near duplicates share a key: same museum find, same Flickr series", () => {
  const a = photoKey("File:Late Iron Age to Roman, Bovine Vessel Mount. Copyright Lisa Chapman (FindID 235509).jpg", "u1");
  const b = photoKey("File:Late Iron Age to Roman, Bovine Vessel Mount (FindID 235509).jpg", "u2");
  assert.equal(a, b);
  const c = photoKey("File:Staircase on slope with awkward first step (43905938312).jpg", "u3");
  const d = photoKey("File:Staircase on slope with awkward first step (43905935302).jpg", "u4");
  assert.equal(c, d);
  // Camera codes are not merged.
  assert.notEqual(photoKey("File:DSC 0042.jpg", "u5"), photoKey("File:DSC 0043.jpg", "u6"));
});

test("dedupe within a set skips near duplicates", () => {
  const k = "t:bovine vessel mount";
  const picks = assignUnique(
    [
      [{ src: "u1", key: k }, { src: "u7", key: "t:hiking woods" }],
      [{ src: "u2", key: k }, { src: "u8", key: "t:senior couple" }],
    ],
    [],
  );
  assert.deepEqual(picks.map((p) => p?.src), ["u1", "u8"]);
  // An excluded key blocks every file in that series.
  const again = assignUnique([[{ src: "u2", key: k }, { src: "u9", key: "t:gym" }]], [], [k]);
  assert.equal(again[0]?.src, "u9");
});

const jpg = { mime: "image/jpeg", width: 3000, height: 2000 };

test("museum finds, medical images, statues, and ID portraits are not scene stock", () => {
  assert.equal(isSceneStock({ title: "File:Bovine Vessel Mount (FindID 235509).jpg", ...jpg }), false);
  assert.equal(isSceneStock({ title: "File:Brooch.jpg", ...jpg, categories: "Portable Antiquities Scheme" }), false);
  assert.equal(isSceneStock({ title: "File:Cremasteric Reflex in cold and warm water.jpg", ...jpg }), false);
  assert.equal(isSceneStock({ title: "File:Athlete or Ephebe, Acropolis Museum.jpg", ...jpg }), false);
  assert.equal(isSceneStock({ title: "File:John Smith official portrait.jpg", ...jpg }), false);
  assert.equal(isSceneStock({ title: "File:Man swimming in frozen water.jpg", ...jpg }), true);
});

test("ranking follows query overlap, and buildings only rank when asked for", () => {
  const swim = stockScore({ title: "File:Man swimming in frozen water.jpg", ...jpg }, "cold water swimming");
  const timer = stockScore({ title: "File:Kitchen timer.jpg", ...jpg }, "cold water swimming");
  assert.ok(swim.score > timer.score);
  assert.equal(timer.overlap, 0);
  const church = { title: "File:St Mary church at sunrise.jpg", ...jpg };
  assert.ok(stockScore(church, "sunrise morning").score < stockScore(church, "church sunrise").score);
});

test("a Wikimedia file must mention the query in its title", () => {
  const item = { src: "s", title: "File:Virginia National Guard (35686861742).jpg", credit: "", attribution: "", provider: "wikimedia" as const, text: "", info: { title: "File:Virginia National Guard (35686861742).jpg", ...jpg, description: "senior couple" } };
  assert.equal(scoreFor(item, "active senior couple"), null);
});

test("Pexels photos map to our shape with the photographer credit", () => {
  const p = fromPexels({ id: 1, url: "https://www.pexels.com/photo/1/", alt: "Woman sleeping in bed", photographer: "Jane Doe", src: { large: "https://images.pexels.com/photos/1/a.jpeg?w=940" } });
  assert.equal(p?.attribution, "Photo by Jane Doe on Pexels");
  assert.equal(p?.provider, "pexels");
  assert.equal(p?.title, "Woman sleeping in bed");
  assert.equal(fromPexels({ id: 2, url: "x" }), null);
  assert.ok(allowedImage("https://images.pexels.com/photos/1/a.jpeg?w=940"));
  assert.equal(allowedImage("https://example.com/a.jpg"), null);
});

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    return new Response(JSON.stringify(handler(url, init)), { status: 200 });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const pexelsPage = (q: string) => ({
  photos: Array.from({ length: 8 }, (_, i) => ({
    id: i,
    url: `https://www.pexels.com/photo/${encodeURIComponent(q)}-${i}/`,
    alt: `${q} ${i}`,
    photographer: `Photographer ${i}`,
    src: { large: `https://images.pexels.com/photos/${encodeURIComponent(q)}/${i}.jpeg` },
  })),
});

test("without PEXELS_API_KEY nothing calls Pexels", async () => {
  delete process.env.PEXELS_API_KEY;
  assert.deepEqual(await searchPexels("gym", 1), []);
  const m = mockFetch(() => ({ query: { pages: {} } }));
  try {
    await pickPhotos({ lines: [`No key line ${Date.now()}`], queries: { scenes: [[`nokey ${Date.now()}`]], topic: [] } });
  } finally {
    m.restore();
  }
  assert.ok(m.calls.length > 0);
  assert.ok(m.calls.every((u) => u.includes("wikimedia.org")));
});

test("with PEXELS_API_KEY, Pexels comes first with credit and Wikimedia is skipped when it has enough", async () => {
  process.env.PEXELS_API_KEY = "test-key";
  let auth = "";
  const stamp = Date.now();
  const m = mockFetch((url, init) => {
    if (url.includes("pexels.com")) {
      auth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
      return pexelsPage(decodeURIComponent(url.split("query=")[1].split("&")[0]));
    }
    return { query: { pages: {} } };
  });
  try {
    const r = await pickPhotos({
      lines: ["Sleep is the first lever.", "Muscle is the second."],
      queries: { scenes: [[`person sleeping ${stamp}`], [`weightlifting gym ${stamp}`]], topic: [] },
    });
    assert.equal(auth, "test-key");
    assert.ok(r.picks.every((p) => p?.provider === "pexels"));
    assert.match(r.picks[0]!.attribution, /^Photo by Photographer \d on Pexels$/);
    assert.notEqual(r.picks[0]!.src, r.picks[1]!.src);
    assert.ok(!m.calls.some((u) => u.includes("wikimedia.org")));
  } finally {
    m.restore();
    delete process.env.PEXELS_API_KEY;
  }
});

test("effort is only sent to models that accept it", () => {
  assert.equal(supportsEffort("claude-haiku-4-5"), false);
  assert.equal(supportsEffort("claude-sonnet-4-6"), true);
  assert.equal(supportsEffort("claude-opus-4-7"), true);
});
