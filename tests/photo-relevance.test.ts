import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanQuery, parseQueries, sanitizeQueries, visualQueries } from "../lib/cut/visual-queries";
import { assignUnique, photoKey } from "../lib/cut/photo-pool";
import { isSceneStock, stockScore } from "../lib/cut/photo-filter";
import { fromPexels, searchPexels } from "../lib/cut/pexels";
import { allowedImage, pickPhotos, scoreFor } from "../lib/cut/clips";
import { supportsEffort } from "../lib/ai-budget";

// Tests must not depend on (or use) real provider keys from the shell.
delete process.env.PEXELS_API_KEY;
delete process.env.PIXABAY_API_KEY;

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

import { fromPixabay, pixabayUrl, searchPixabay } from "../lib/cut/pixabay";

const pixabayPage = (q: string, n = 8) => ({
  hits: Array.from({ length: n }, (_, i) => ({
    id: 1000 + i,
    type: "photo",
    pageURL: `https://pixabay.com/photos/${encodeURIComponent(q)}-${i}/`,
    tags: `${q}, people`,
    webformatURL: `https://pixabay.com/get/${encodeURIComponent(q)}_${i}_640.jpg`,
    largeImageURL: `https://pixabay.com/get/${encodeURIComponent(q)}_${i}_1280.jpg`,
    user: `user${i}`,
  })),
});

test("Pixabay hits map to our shape with attribution, photos only", () => {
  const p = fromPixabay({ id: 7, type: "photo", pageURL: "https://pixabay.com/photos/x-7/", tags: "gym, weights", largeImageURL: "https://pixabay.com/get/a_1280.jpg", webformatURL: "https://pixabay.com/get/a_640.jpg", user: "Josch13" });
  assert.equal(p?.src, "https://pixabay.com/get/a_1280.jpg");
  assert.equal(p?.attribution, "Image by Josch13 from Pixabay");
  assert.equal(p?.credit, "https://pixabay.com/photos/x-7/");
  assert.equal(p?.provider, "pixabay");
  assert.equal(fromPixabay({ id: 8, type: "illustration", largeImageURL: "https://pixabay.com/get/b.jpg" }), null);
  assert.ok(allowedImage("https://pixabay.com/get/a_1280.jpg"));
  assert.ok(allowedImage("https://cdn.pixabay.com/photo/2013/10/15/09/12/flower-195893_150.jpg"));
});

test("Pixabay requests ask for safe photos and stay inside the limits", () => {
  const u = new URL(pixabayUrl("k", "x".repeat(150), 0, 500));
  assert.equal(u.searchParams.get("image_type"), "photo");
  assert.equal(u.searchParams.get("safesearch"), "true");
  assert.equal(u.searchParams.get("per_page"), "200");
  assert.equal(u.searchParams.get("page"), "1");
  assert.equal(u.searchParams.get("q")?.length, 100);
});

test("without PIXABAY_API_KEY nothing calls Pixabay", async () => {
  delete process.env.PIXABAY_API_KEY;
  assert.deepEqual(await searchPixabay("gym", 1), []);
});

test("Pixabay is used before Wikimedia, and never logs the key", async () => {
  process.env.PIXABAY_API_KEY = "secret-pixabay-key";
  const stamp = Date.now();
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
  const m = mockFetch((url) => {
    if (url.includes("pixabay.com/api")) {
      const q = new URL(url).searchParams.get("q") ?? "";
      return pixabayPage(q, q.startsWith("sparse") ? 2 : 8);
    }
    return { query: { pages: {} } };
  });
  try {
    const r = await pickPhotos({
      lines: ["Muscle is the second.", "Sleep is the first lever."],
      queries: { scenes: [[`weightlifting gym ${stamp}`], [`sparse sleep ${stamp}`]], topic: [] },
    });
    assert.equal(r.picks[0]?.provider, "pixabay");
    assert.match(r.picks[0]!.attribution, /from Pixabay$/);
    // Plenty of Pixabay results: no Wikimedia call for that query. Sparse: Wikimedia fills in.
    assert.ok(!m.calls.some((u) => u.includes("wikimedia.org") && u.includes(encodeURIComponent(`weightlifting gym ${stamp}`))));
    assert.ok(m.calls.some((u) => u.includes("wikimedia.org") && u.includes(encodeURIComponent(`sparse sleep ${stamp}`))));
    // Same search again within 24 hours is served from the cache.
    const before = m.calls.filter((u) => u.includes("pixabay.com/api")).length;
    await pickPhotos({ lines: ["Muscle is the second."], queries: { scenes: [[`weightlifting gym ${stamp}`]], topic: [] } });
    assert.equal(m.calls.filter((u) => u.includes("pixabay.com/api")).length, before);
  } finally {
    m.restore();
    console.warn = warn;
    delete process.env.PIXABAY_API_KEY;
  }
  assert.ok(warnings.every((w) => !w.includes("secret-pixabay-key")));
});

test("with both keys, Pexels comes first, then Pixabay", async () => {
  process.env.PEXELS_API_KEY = "p";
  process.env.PIXABAY_API_KEY = "x";
  const stamp = Date.now();
  const m = mockFetch((url) => {
    if (url.includes("api.pexels.com")) return { photos: [] }; // Pexels has nothing for this query
    if (url.includes("pixabay.com/api")) return pixabayPage(new URL(url).searchParams.get("q") ?? "");
    return { query: { pages: {} } };
  });
  try {
    const r = await pickPhotos({ lines: ["Sleep."], queries: { scenes: [[`bedroom night ${stamp}`]], topic: [] } });
    const order = m.calls.map((u) => (u.includes("pexels") ? "pexels" : u.includes("pixabay") ? "pixabay" : "wikimedia"));
    assert.deepEqual(order.slice(0, 2), ["pexels", "pixabay"]);
    assert.equal(r.picks[0]?.provider, "pixabay");
  } finally {
    m.restore();
    delete process.env.PEXELS_API_KEY;
    delete process.env.PIXABAY_API_KEY;
  }
});

test("different stock photos with the same tags are not treated as duplicates", async () => {
  process.env.PIXABAY_API_KEY = "x";
  const stamp = Date.now();
  const m = mockFetch((url) => (url.includes("pixabay.com/api") ? pixabayPage(`same tag ${stamp}`) : { query: { pages: {} } }));
  try {
    const r = await pickPhotos({ lines: ["One.", "Two.", "Three."], queries: { scenes: [[`same tag ${stamp}`], [`same tag ${stamp}`], [`same tag ${stamp}`]], topic: [] } });
    assert.equal(new Set(r.picks.map((p) => p?.src)).size, 3);
    assert.ok(r.picks.every(Boolean));
  } finally {
    m.restore();
    delete process.env.PIXABAY_API_KEY;
  }
});

import { shootKey, stockSiteScore } from "../lib/cut/clips";

test("Pixabay matches need most of the query in the tags, and skip animal photos", () => {
  assert.equal(stockSiteScore("pixabay", "duck, bird, waterfowl, water, winter, cold, swimming", "cold water swimming"), null);
  assert.equal(stockSiteScore("pixabay", "turtle, sea, water, swimming, ocean, animal", "cold water swimming"), null);
  assert.equal(stockSiteScore("pixabay", "cat, pet, sleep, bed", "person sleeping in bed"), null);
  assert.ok((stockSiteScore("pixabay", "woman, asleep, sleep, bed, pillow", "person sleeping in bed") ?? 0) > 0);
  assert.equal(stockSiteScore("pixabay", "mountains, hiking, italy, nature", "running shoes morning"), null);
  assert.ok((stockSiteScore("pixabay", "dog, park, walk", "dog walking park") ?? 0) > 0); // asked for an animal
  const real = stockSiteScore("pixabay", "woman, running, fitness", "woman running")!;
  const made = stockSiteScore("pixabay", "woman, running, fitness, ai generated", "woman running")!;
  assert.ok(real > made);
});

test("the same photographer's shoot counts as one photo", () => {
  const a = shootKey({ provider: "pixabay", title: "kettlebell, arm, strong arm (Pixabay 1203889)", attribution: "Image by Keifit from Pixabay", src: "a" });
  const b = shootKey({ provider: "pixabay", title: "kettlebell, arm, strong arm (Pixabay 1203887)", attribution: "Image by Keifit from Pixabay", src: "b" });
  const c = shootKey({ provider: "pixabay", title: "kettlebell, arm, strong arm (Pixabay 5)", attribution: "Image by Someone from Pixabay", src: "c" });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

import { childPenalty, relevantTo } from "../lib/cut/clips";
import { creditFor } from "../lib/cut/credit";

test("the AI search term step gives up after its time limit and uses keywords", async () => {
  const started = Date.now();
  const got = await visualQueries([`Slow line ${Date.now()}.`], "", () => new Promise<string>(() => {}), 50);
  assert.equal(got.source, "timeout");
  assert.ok(got.scenes[0].length > 0);
  assert.ok(Date.now() - started < 1000);
});

test("children and babies rank lower unless the line is about kids", () => {
  assert.equal(childPenalty("child, outdoors, nature", "weightlifting gym"), 4);
  assert.equal(childPenalty("child, outdoors, nature", "kids playing outside"), 0);
  assert.equal(childPenalty("woman, asleep, girl", "person sleeping"), 0); // girl is common for young women
  const kid = stockSiteScore("pixabay", "child, running, park", "running park")!;
  const adult = stockSiteScore("pixabay", "woman, running, park", "running park")!;
  assert.ok(adult > kid);
});

test("photos whose tags cover more of the query rank higher", () => {
  const full = stockSiteScore("pixabay", "dumbbell, strong, arm, gym", "strong arm dumbbell")!;
  const part = stockSiteScore("pixabay", "dumbbell, strong, sport", "strong arm dumbbell")!;
  assert.ok(full > part);
  assert.equal(stockSiteScore("pixabay", "clock tower, building, time", "laboratory scientist"), null);
});

test("a line only borrows a shared photo that matches one of its words", () => {
  assert.equal(relevantTo("child, outdoors, nature", ["weightlift", "gym", "strong", "arm", "dumbbel"]), false);
  assert.equal(relevantTo("man, gym, fitness", ["weightlift", "gym"]), true);
  const picks = assignUnique(
    [[], [{ src: "gym1" }]],
    (index) => (index === 0 ? [] : [{ src: "x" }]), // scene 0 has nothing relevant in the pool
  );
  assert.equal(picks[0], null);
});

test("an unrelated topic photo is not forced onto a line with no matches", async () => {
  process.env.PIXABAY_API_KEY = "x";
  const stamp = Date.now();
  const m = mockFetch((url) => {
    if (!url.includes("pixabay.com/api")) return { query: { pages: {} } };
    const q = new URL(url).searchParams.get("q") ?? "";
    if (q.startsWith("topic")) {
      return { hits: [
        { id: 1, type: "photo", pageURL: "https://pixabay.com/p/1/", tags: `child, outdoors, nature, topic, healthy ${stamp}`, webformatURL: "https://pixabay.com/get/c1_640.jpg", user: "u1" },
        { id: 2, type: "photo", pageURL: "https://pixabay.com/p/2/", tags: `clock tower, building, topic, healthy ${stamp}`, webformatURL: "https://pixabay.com/get/c2_640.jpg", user: "u2" },
      ] };
    }
    return { hits: [] };
  });
  try {
    const r = await pickPhotos({
      lines: ["Muscle is the second."],
      queries: { scenes: [[`weightlifting gym ${stamp}`, `strong arm dumbbell ${stamp}`]], topic: [`topic healthy ${stamp}`] },
    });
    assert.equal(r.picks[0], null); // built-in still beats a child or a clock tower
  } finally {
    m.restore();
    delete process.env.PIXABAY_API_KEY;
  }
});

test("credits name the photographer and source, never the raw ID", () => {
  assert.equal(creditFor({ provider: "pixabay", attribution: "Image by Josch13 from Pixabay", title: "gym, weights (Pixabay 123456)" }), "Image by Josch13 from Pixabay");
  assert.equal(creditFor({ provider: "wikimedia", title: "File:Bedroom @ night (3119861751).jpg" }), "Bedroom @ night, Wikimedia Commons");
  assert.ok(!/\d{6,}/.test(creditFor({ provider: "pixabay", title: "x (Pixabay 123456)" })));
});

import { fitsCard } from "../lib/cut/credit";

test("a spare photo only stands in for a card it fits", () => {
  const sleep = { text: "bed, sleep, girl", title: "bed, sleep, girl (Pixabay 945881)" };
  assert.equal(fitsCard(sleep, ["older man jogging", "elderly woman walking outdoors"]), false);
  assert.equal(fitsCard(sleep, ["person sleeping in bed", "bedroom at night"]), true);
});
