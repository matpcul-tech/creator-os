import test from "node:test";
import assert from "node:assert/strict";
import { WEARABLES_LINES, WEARABLES_SCRIPT, WEARABLES_TITLE } from "./fixtures/wearables-150";
import { groupLines, MAX_SCENES, overLimitNote, planScenes, SCENE_MAX_WORDS } from "../lib/cut/scenes";
import { directPlan, directScript } from "../lib/cut/direct";
import { planCards, splitCards } from "../lib/cut/builder-cards";
import { layoutParts, voiceBatches, voiceLimitNote, VOICE_BATCH_CHARS } from "../lib/cut/voice-plan";
import { marksFromSpans, sceneWindows } from "../lib/cut/timeline";
import { placePhotos, PHOTO_BATCH, type PlaceItem } from "../lib/cut/place-photos";
import { voiceTrack } from "../lib/cut/voice-track";
import { MAX_VOICE_CHARS } from "../lib/cut/narrate";

const words = (text: string) => text.split(/\s+/).filter(Boolean);
const squash = (text: string) => words(text).join(" ");
const DASHES = /[\u2012\u2013\u2014\u2015]/;

/** Every input line shows up exactly once, in order, across the groups. */
function assertCoverage(lines: string[], groups: { text: string; lines: number[] }[]) {
  const order = groups.flatMap((group) => group.lines);
  assert.deepEqual(order, lines.map((_, i) => i), "each line index once, in order");
  for (const group of groups) assert.equal(group.text, group.lines.map((i) => lines[i].trim()).join(" "));
}

test("a 150 line script groups into sensible scenes that use every line once, in order", () => {
  assert.equal(WEARABLES_LINES.length, 150);
  const groups = groupLines(WEARABLES_LINES);
  assertCoverage(WEARABLES_LINES, groups);
  assert.ok(groups.length > 60, `more than the old 60 cap would have allowed: ${groups.length}`);
  assert.ok(groups.length <= 100, `short lines are grouped: ${groups.length}`);
  for (const group of groups) {
    const n = words(group.text).length;
    if (group.lines.length > 1) assert.ok(n <= SCENE_MAX_WORDS + 4, `a grouped scene stays short: ${n} words`);
  }
  // Roughly 4 to 8 seconds a scene at about 2.4 spoken words a second.
  const average = words(WEARABLES_SCRIPT).length / groups.length;
  assert.ok(average >= 9 && average <= 19, `average ${average.toFixed(1)} words a scene`);
});

test("the faceless cut covers the whole 150 line script, last line included", () => {
  const plan = directPlan(WEARABLES_SCRIPT);
  assert.equal(plan.lineCount, 150);
  assert.equal(plan.omittedLines, 0);
  assert.equal(overLimitNote(plan), "");
  assert.equal(squash(plan.scenes.map((scene) => scene.narration).join(" ")), squash(WEARABLES_SCRIPT));
  assert.match(plan.scenes[plan.scenes.length - 1].narration, /See you in the next one\.$/);
  assert.equal(directScript(WEARABLES_SCRIPT).length, plan.scenes.length);
  assert.equal(new Set(plan.scenes.map((scene) => scene.id)).size, plan.scenes.length, "scene ids stay unique");
});

test("the builder cards cover the whole 150 line script with no 60 card cap", () => {
  const cards = splitCards(WEARABLES_LINES);
  assert.ok(cards.length > 60);
  assert.equal(squash(cards.join(" ")), squash(WEARABLES_SCRIPT));
  const plan = planCards(WEARABLES_LINES);
  assert.equal(plan.omittedLines, 0);
  assert.deepEqual(plan.scenes, cards);
});

test("a script past the one video limit says so plainly instead of dropping lines quietly", () => {
  const lines = Array.from({ length: 3000 }, (_, i) => `Line ${i + 1} is one full sentence with enough words in it.`);
  const plan = planScenes(lines);
  assert.equal(plan.scenes.length, MAX_SCENES);
  assert.ok(plan.omittedLines > 0);
  assert.equal(plan.lineCount - plan.omittedLines, plan.groups.flatMap((g) => g.lines).length);
  const note = overLimitNote(plan);
  assert.match(note, new RegExp(`first ${plan.lineCount - plan.omittedLines} of 3000 lines`));
  assert.match(note, /Split the script into two videos/);
  assert.doesNotMatch(note, DASHES);

  // The faceless cut counts the script's own lines in the note.
  const cut = directPlan(lines.join("\n"));
  assert.equal(cut.scenes.length, MAX_SCENES);
  assert.equal(cut.lineCount, 3000);
  assert.ok(cut.omittedLines > 0 && cut.omittedLines < 3000);
  assert.match(overLimitNote(cut), new RegExp(`first ${3000 - cut.omittedLines} of 3000 lines`));
  assert.match(cut.scenes[cut.scenes.length - 1].narration, new RegExp(`Line ${3000 - cut.omittedLines} is`));
});

test("voice requests split the script by whole scenes and stay under the server limit", () => {
  const scenes = directScript(WEARABLES_SCRIPT).map((scene) => scene.narration);
  const batches = voiceBatches(scenes);
  assert.deepEqual(batches.flat(), scenes.map((_, i) => i), "every scene voiced once, in order");
  for (const batch of batches) {
    const chars = batch.map((i) => scenes[i]).join(" ").length;
    assert.ok(chars <= VOICE_BATCH_CHARS && chars <= MAX_VOICE_CHARS, `${chars} chars`);
  }
  assert.ok(batches.length >= 4 && batches.length <= 8, `${batches.length} voice requests for the 150 line script`);
});

test("scene changes land where each scene's narration starts", () => {
  const scenes = directScript(WEARABLES_SCRIPT);
  // Two audio pieces for every third scene, one for the rest.
  const counts = scenes.map((_, i) => (i % 3 === 0 ? 2 : 1));
  const seconds = counts.flatMap((count, i) => Array.from({ length: count }, () => 1.5 + (i % 4) * 0.5));
  const layout = layoutParts(seconds, counts);
  assert.equal(layout.spans.length, scenes.length);
  assert.equal(layout.partStarts.length, seconds.length);
  for (let i = 1; i < layout.spans.length; i++) assert.ok(layout.spans[i].start > layout.spans[i - 1].end, "spans in order with a gap");
  const marks = marksFromSpans(scenes, layout.spans, layout.total);
  assert.equal(marks.words.length, words(scenes.map((s) => s.narration).join(" ")).length, "every word is timed");
  const windows = sceneWindows(marks.words, scenes.length, marks.duration);
  windows.forEach((window, i) => {
    if (i > 0) assert.ok(Math.abs(window.start - layout.spans[i].start) < 1e-9, `scene ${i + 1} starts with its narration`);
  });
  assert.ok(Math.abs(windows[windows.length - 1].end - marks.duration) < 1e-9);
  assert.ok(marks.duration >= layout.total, "the cut lasts as long as the voice");
});

test("photos for a long script go in batches with no repeat anywhere in the video", async () => {
  const lines = directScript(WEARABLES_SCRIPT).map((scene) => scene.narration);
  const bodies: Record<string, unknown>[] = [];
  let serial = 0;
  // Every batch offers some photos the earlier batches already used, plus new ones.
  const fetchItems = async (body: Record<string, unknown>) => {
    bodies.push(body);
    const asked = body.lines as string[];
    const items = asked.map((_, k) => (k % 5 === 0 && serial > 0 ? { src: "p0", url: "/u/p0" } : { src: `p${++serial}`, url: `/u/p${serial}` }));
    const pool = Array.from({ length: 6 }, () => ({ src: `p${++serial}`, url: `/u/p${serial}` }));
    return { items, pool, queries: { scenes: asked.map((line) => [line.slice(0, 10)]), topic: ["t"] } };
  };
  const picked: number[] = [];
  const { picks, requests, queries } = await placePhotos<PlaceItem>({
    lines,
    topic: WEARABLES_TITLE,
    fetchItems,
    load: async () => true,
    onPick: (i) => picked.push(i),
    retryDelayMs: 1,
  });
  assert.ok(bodies.every((body) => (body.lines as string[]).length <= PHOTO_BATCH), "every request is small");
  assert.ok(requests >= Math.ceil(lines.length / PHOTO_BATCH));
  const srcs = picks.map((p) => p?.src ?? null);
  assert.ok(srcs.every(Boolean), "every scene gets a photo, the last one included");
  assert.equal(new Set(srcs).size, srcs.length, "no photo repeats across batches");
  assert.equal(new Set(picked).size, lines.length);
  const later = bodies.find((body) => (body.context as string[]).length > 0)!;
  assert.ok((later.exclude as string[]).includes("p1"), "later batches exclude photos already used");
  assert.equal((later.context as string[]).length, 6, "the lines before a batch go along for topic anchoring");
  assert.equal(queries?.scenes.length, lines.length, "queries come back for every scene, for a reshuffle");
});

// A stand in for the browser's audio: each base64 part decodes to a buffer as long as its text says.
function fakeAudio() {
  const buffer = (seconds: number, rate = 24000) => {
    const data = new Float32Array(Math.max(1, Math.round(seconds * rate)));
    return { duration: seconds, sampleRate: rate, numberOfChannels: 1, length: data.length, getChannelData: () => data } as unknown as AudioBuffer;
  };
  return {
    decodeAudioData: async (bytes: ArrayBuffer) => buffer(Number(new TextDecoder().decode(bytes))),
    createBuffer: (_channels: number, length: number, rate: number) => buffer(length / rate, rate),
  } as unknown as BaseAudioContext;
}

function mockVoice(handler: (segments: string[], call: number) => { status: number; body: unknown }, left: number | null = 100) {
  const original = globalThis.fetch;
  const posts: string[][] = [];
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    if (!init || init.method !== "POST") return new Response(JSON.stringify({ ready: true, left, limit: 100 }), { status: 200 });
    const { segments } = JSON.parse(String(init.body)) as { segments: string[] };
    posts.push(segments);
    const { status, body } = handler(segments, posts.length);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { posts, restore: () => (globalThis.fetch = original) };
}

const voiced = (segments: string[]) => ({
  status: 200,
  body: { ok: true, parts: segments.map(() => btoa("2")), counts: segments.map(() => 1) },
});

test("the voice reads every scene of the long script and times each one", async () => {
  const scenes = directScript(WEARABLES_SCRIPT).map((scene) => scene.narration);
  const m = mockVoice((segments) => voiced(segments));
  try {
    const track = await voiceTrack({ segments: scenes, voiceId: "orion", context: fakeAudio() });
    assert.ok(track.ok);
    if (!track.ok) return;
    assert.equal(track.spans.length, scenes.length);
    assert.deepEqual(m.posts.flat(), scenes, "every scene sent once, in order");
    assert.ok(track.total > scenes.length * 2, "the track is as long as every scene together");
  } finally {
    m.restore();
  }
});

test("a voice failure names the scenes and returns no partial track; a retry only asks for those", async () => {
  const scenes = directScript(WEARABLES_SCRIPT).map((scene) => `${scene.narration} (retry check)`);
  let broken = true;
  const m = mockVoice((segments, call) => (broken && call >= 3 && segments.join(" ").includes("See you") ? { status: 400, body: { ok: false, error: "Voice didn't answer" } } : voiced(segments)));
  try {
    const first = await voiceTrack({ segments: scenes, voiceId: "orion", context: fakeAudio() });
    assert.equal(first.ok, false);
    if (first.ok) return;
    assert.match(first.error, new RegExp(`The voice could not read scenes \\d+ to ${scenes.length} of ${scenes.length}`));
    assert.doesNotMatch(first.error, DASHES);
    const before = m.posts.length;
    broken = false;
    const second = await voiceTrack({ segments: scenes, voiceId: "orion", context: fakeAudio() });
    assert.ok(second.ok);
    assert.equal(m.posts.length - before, 1, "only the failed part is asked for again");
  } finally {
    m.restore();
  }
});

test("when today's voice limit cannot cover the script, nothing is voiced and the note says why", async () => {
  const scenes = directScript(WEARABLES_SCRIPT).map((scene) => `${scene.narration} (limit check)`);
  const m = mockVoice((segments) => voiced(segments), 2);
  try {
    const track = await voiceTrack({ segments: scenes, voiceId: "orion", context: fakeAudio() });
    assert.equal(track.ok, false);
    if (track.ok) return;
    assert.equal(m.posts.length, 0, "no request is spent on a script that cannot finish");
    assert.match(track.error, /needs \d+ voice requests and today's voice limit has 2 of 100 left/);
    assert.doesNotMatch(track.error, DASHES);
  } finally {
    m.restore();
  }
  assert.equal(voiceLimitNote(3, 5, 100), "");
  assert.equal(voiceLimitNote(3, null, 100), "");
});
