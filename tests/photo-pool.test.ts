import { test } from "node:test";
import assert from "node:assert/strict";
import { assignUnique, spreadStills } from "../lib/cut/photo-pool";
import { isLikelyPhoto } from "../lib/cut/photo-filter";
import { directScript } from "../lib/cut/direct";

const p = (src: string) => ({ src });

test("no photo repeats across scenes while unused photos remain", () => {
  // Every scene's best match is the same photo, as happens with generic queries.
  const perScene = [
    [p("a"), p("b")],
    [p("a"), p("b"), p("c")],
    [p("a")],
    [p("a"), p("b")],
  ];
  const picks = assignUnique(perScene, [p("t1"), p("t2")]);
  const srcs = picks.map((x) => x?.src);
  assert.equal(new Set(srcs).size, srcs.length);
  assert.deepEqual(srcs.slice(0, 2), ["a", "b"]);
});

test("empty scenes fall back to the topic pool before anything repeats", () => {
  const picks = assignUnique([[p("a")], [], [p("a")]], [p("t1"), p("t2")]);
  assert.deepEqual(picks.map((x) => x?.src), ["a", "t1", "t2"]);
});

test("photos already shown are never picked again", () => {
  const picks = assignUnique([[p("a"), p("b")], [p("c"), p("d")]], [p("e")], ["a", "c"]);
  assert.deepEqual(picks.map((x) => x?.src), ["b", "d"]);
});

test("a photo is never reused, even when the pool runs out", () => {
  const picks = assignUnique([[p("a")], [p("a")], [p("b")], [p("a")], [], []], [p("c")]);
  const srcs = picks.map((x) => x?.src ?? null);
  assert.deepEqual(srcs, ["a", "c", "b", null, null, null]);
});

test("a scene stays empty (built-in still) rather than repeat its neighbor", () => {
  const picks = assignUnique([[p("a")], [p("a")], [p("b")]], []);
  assert.deepEqual(picks.map((x) => x?.src ?? null), ["a", null, "b"]);
});

test("built-in stills spread evenly instead of bouncing between two", () => {
  const ids = ["desk", "city", "mic", "path"] as const;
  const zero = { desk: 0, city: 0, mic: 0, path: 0 };
  const out = spreadStills(Array.from({ length: 8 }, () => ({ ...zero })), [...ids]);
  for (const id of ids) assert.equal(out.filter((x) => x === id).length, 2);
  for (let i = 1; i < out.length; i++) assert.notEqual(out[i], out[i - 1]);
});

test("the photo filter keeps files that say photograph or Wiki Loves", () => {
  const size = { mime: "image/jpeg", width: 4000, height: 3000 };
  assert.equal(isLikelyPhoto({ title: "File:City street at night photograph.jpg", ...size }), true);
  assert.equal(isLikelyPhoto({ title: "File:Old town.jpg", ...size, categories: "Wiki Loves Monuments 2021|Photographs by Jane" }), true);
  assert.equal(isLikelyPhoto({ title: "File:Iconic bridge.jpg", ...size }), true);
  assert.equal(isLikelyPhoto({ title: "File:Sales_graph_2020.jpg", ...size }), false);
});

test("long scripts are not cut at 20 lines", () => {
  const script = Array.from({ length: 35 }, (_, i) => `Line number ${i + 1} says one thing.`).join("\n\n");
  const scenes = directScript(script);
  // Short lines share scenes now, and every line is still spoken.
  assert.ok(scenes.length < 35 && scenes.length >= 12, `${scenes.length} scenes`);
  assert.match(scenes[scenes.length - 1].narration, /35/);
  for (let i = 1; i <= 35; i++) assert.equal(scenes.filter((scene) => scene.narration.includes(`number ${i} `)).length, 1);
});
