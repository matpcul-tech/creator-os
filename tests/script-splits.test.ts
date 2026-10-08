import test from "node:test";
import assert from "node:assert/strict";
import { shapeScript } from "../lib/cut/direct";
import { splitCards } from "../lib/cut/builder-cards";
import { splitClauses, splitSentences } from "../lib/cut/sentences";

const VO2 = "VO2 max is one of the strongest predictors of long-term health and longevity.";
const OURA = "And the Oura Ring gives you a window into your recovery that your phone never could.";
const lines = (text: string) => text.split(/\n+/).filter(Boolean);
const squash = (text: string) => text.replace(/\s+/g, " ").trim();

test("the reported VO2 max and Oura Ring lines stay whole sentences", () => {
  for (const sentence of [VO2, OURA]) {
    const out = lines(shapeScript(sentence));
    assert.deepEqual(out, [sentence]);
    assert.doesNotMatch(out.join(" "), /long\. Term|your\. Recovery/);
  }
  // The en dash version of long term becomes a hyphen, not a sentence break.
  assert.deepEqual(lines(shapeScript(VO2.replace("long-term", "long\u2013term"))), [VO2]);
  assert.deepEqual(splitCards([VO2, OURA]), [VO2, OURA]);
});

test("shaping never adds punctuation or changes a word", () => {
  const script = [
    "Dr. Peter Attia tracks VO2 max, grip strength, and sleep because those predict how long you stay independent.",
    "Most people are shocked by what they find.",
    "A CGM shows how your glucose responds to 2.5 hours of sleep, a late meal, or a hard workout, and the data changes how you eat for good.",
    OURA,
  ].join("\n");
  const shaped = shapeScript(script);
  assert.equal(squash(shaped), squash(script));
  assert.doesNotMatch(shaped, /Dr\.\n|2\.\n/);
});

test("long sentences split only after a clause mark or before a joining word", () => {
  const long = "Wearables like WHOOP, Garmin, and the Oura Ring measure heart rate variability overnight, which tells you how recovered you are before you train hard again.";
  const parts = splitClauses(long, { trigger: 12, target: 12, hard: 24 });
  assert.ok(parts.length >= 2);
  assert.equal(parts.join(" "), long);
  for (const part of parts.slice(0, -1)) assert.match(part, /[,;:]$/);

  const noMarks = "The Eight Sleep pod cools the bed through the night and it raises the temperature before you wake up so you get out of bed without an alarm clock ringing";
  const pieces = splitClauses(noMarks, { trigger: 12, target: 12, hard: 24 });
  assert.equal(pieces.join(" "), noMarks);
  for (const piece of pieces.slice(1)) assert.match(piece, /^(and|so|because|which|while|when|but|or)\b/);

  const solid = "Supercalifragilistic metabolic flexibility markers predict outcomes across decades of careful longitudinal cohort research with many thousands of carefully followed healthy adult participants worldwide today";
  assert.deepEqual(splitClauses(solid, { trigger: 12, target: 12, hard: 24 }), [solid], "no clause mark and no joining word: stays whole");
});

test("sentence split respects abbreviations, initials and decimals", () => {
  assert.deepEqual(splitSentences("Dr. Attia sleeps 8.5 hours. J. Smith agrees. Sleep wins!"), ["Dr. Attia sleeps 8.5 hours.", "J. Smith agrees.", "Sleep wins!"]);
  assert.deepEqual(splitSentences("It works, e.g. for sleep. Then rest."), ["It works, e.g. for sleep.", "Then rest."]);
});

test("shaping is stable when run again", () => {
  const once = shapeScript(`${VO2} ${OURA}\nA spaced dash - like this \u2014 becomes a pause.`);
  assert.equal(shapeScript(once), once);
  assert.doesNotMatch(once, /[\u2013\u2014]/);
});
