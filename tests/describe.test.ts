import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import { beatsFromVisual } from "../lib/produce/describe";
import { drawBeatPng, drawBeatSvg } from "../lib/produce/draw";
import { speechText } from "../lib/produce/text";
import { SOVEREIGN_PALETTE } from "../lib/produce/types";

test("speech text replaces dashes and arrows with plain words", () => {
  assert.equal(speechText("Rent \u2192 own"), "Rent to own");
  assert.equal(speechText("price \u2014 fact"), "price, fact");
  assert.equal(speechText("CoreWeave's bonds"), "CoreWeave's bonds");
});

test("episode visuals become specific cards, not one generic still", { skip: !existsSync("/cursor/stores/bot/sovereign-ep01/scenes.json") }, () => {
  const scenes = JSON.parse(readFileSync("/cursor/stores/bot/sovereign-ep01/scenes.json", "utf8")) as {
    title: string;
    visual: string;
  }[];
  const counts = scenes.map((scene) => beatsFromVisual(scene.visual, scene.title));
  assert.equal(counts[0].length, 2);
  assert.equal(counts[0][0].kind, "cds");
  assert.equal(counts[0][1].kind, "gpu");
  assert.equal(counts[1].length, 5);
  assert.deepEqual(counts[1].map((beat) => beat.kind), ["flow", "stat", "bars", "table", "note"]);
  assert.ok(counts.every((beats) => beats.every((beat) => beat.kind !== "generic")));
  const svg = drawBeatSvg({
    beat: counts[0][0],
    aspect: "16:9",
    palette: SOVEREIGN_PALETTE,
    channel: "Sovereign",
    sceneIndex: 0,
    sceneTotal: 7,
  });
  assert.match(svg, /#0B1F33/);
  assert.match(svg, /#F2A900/);
  assert.match(svg, /DISTRESS LINE/);
  assert.match(svg, /1,145 bp/);
  assert.doesNotMatch(svg, /2025: \d/);
  const png = drawBeatPng(svg, "16:9");
  assert.equal(png.readUInt32BE(16), 1920);
  assert.equal(png.readUInt32BE(20), 1080);
});
