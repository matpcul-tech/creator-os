import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import { beatsFromVisual, stagesForScene } from "../lib/produce/describe";
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
  assert.match(svg, /font-family="Inter"/);
  assert.doesNotMatch(svg, /DejaVu/);

  const you = counts[3].find((beat) => /service agreement/i.test(beat.body));
  assert.ok(you);
  const youSvg = drawBeatSvg({
    beat: you,
    aspect: "16:9",
    palette: SOVEREIGN_PALETTE,
    channel: "Sovereign",
    sceneIndex: 3,
    sceneTotal: 7,
  });
  assert.match(youSvg, />YOU</);
  assert.match(youSvg, /service agreement/);
  assert.match(youSvg, /fine-tuned weights/);
  assert.match(youSvg, /IBM Plex Sans/);

  const paths = counts[5][0];
  assert.equal(paths.kind, "compare");
  const pathSvg = drawBeatSvg({
    beat: { ...paths, providerState: 1 },
    aspect: "16:9",
    palette: SOVEREIGN_PALETTE,
    channel: "Sovereign",
    sceneIndex: 5,
    sceneTotal: 7,
  });
  assert.match(pathSvg, /RENTED/);
  assert.match(pathSvg, /OWNED/);
  assert.match(pathSvg, /RESTRUCTURED/);
  assert.match(pathSvg, /Encryption keys/);

  const vertical = drawBeatSvg({
    beat: counts[0][1],
    aspect: "9:16",
    palette: SOVEREIGN_PALETTE,
    channel: "Sovereign",
    sceneIndex: 0,
    sceneTotal: 7,
  });
  assert.match(vertical, /SOURCE:/);
  assert.match(vertical, /y="98"/);
  assert.doesNotMatch(vertical, /y="1670"/);

  const questions = counts[6].find((beat) => beat.kind === "list");
  assert.ok(questions);
  const stages = stagesForScene(
    counts[6],
    [
      { text: "takeaway", start: 1, end: 1.4 },
      { text: "lien", start: 8, end: 8.4 },
      { text: "debt", start: 12, end: 12.4 },
      { text: "keys", start: 16, end: 16.5 },
      { text: "sovereignshieldtechnologies.com", start: 22, end: 23 },
    ],
    30,
  );
  const reveals = stages.filter((stage) => stage.beat.kind === "list").map((stage) => stage.beat.reveal);
  assert.deepEqual(reveals, [0, 1, 2, 3]);
  assert.equal(stages.at(-1)?.beat.kind, "url");
  assert.ok(stages[1].start >= 8);
  assert.ok(stages[2].start >= 12);
  assert.ok(stages[3].start >= 16);
});
