import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPENING_RULE,
  TAKEAWAY_RULE,
  continuationRuleNote,
  injectPreviousResult,
  openingText,
  previousResultLine,
  readOptionalFinite,
  rewriteFeedback,
  ruleRejection,
  scriptRuleViolations,
} from "../lib/script-rules";

const DASHES = /[\u2012\u2013\u2014\u2015]/;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const FLUFF_UNIT = "Most creators guess and keep guessing while they chase views and forget the format";

function fluff(count: number): string {
  const words: string[] = [];
  while (words.length < count) words.push(...FLUFF_UNIT.split(" "));
  return words.slice(0, count).join(" ");
}

function rules(script: string): string[] {
  return scriptRuleViolations(script).map((v) => v.rule);
}

test("a question, number, date, money, percent, or named entity satisfies the opening", () => {
  assert.deepEqual(rules("Why do most newsletters stall?\n\nTakeaway: ship one issue a week."), []);
  assert.deepEqual(rules("In 2024, 73% of new channels quit.\n\nTakeaway: pick one format."), []);
  assert.ok(!rules("Last March the channel stalled and the posting habit fell apart.\n\nTakeaway: post on Fridays.").includes(OPENING_RULE));
  assert.ok(!rules("Creators lose dollars every time they ignore the hook.\n\nTakeaway: open with a fact.").includes(OPENING_RULE));
  assert.ok(!rules("A large percent of viewers leave when the opening stays vague.\n\nTakeaway: name a number.").includes(OPENING_RULE));
  assert.ok(!rules("Three habits separate channels that last from channels that quit.\n\nTakeaway: pick one habit.").includes(OPENING_RULE));
  assert.ok(!rules("Google cut creator pay and said nothing about the timeline.\n\nTakeaway: read the terms.").includes(OPENING_RULE));
  assert.ok(!rules("NASA found a signal and the lab stayed quiet.\n\nTakeaway: wait for the paper.").includes(OPENING_RULE));
  assert.ok(!rules("Taylor Swift released a surprise song at midnight.\n\nTakeaway: timing matters.").includes(OPENING_RULE));
  assert.ok(!rules("YouTube keeps more watch time when the opening states a fact.\n\nTakeaway: state the fact.").includes(OPENING_RULE));
  assert.ok(!rules("iPhone owners repeat the same charging mistake every night.\n\nTakeaway: stop overnight charging.").includes(OPENING_RULE));
});

test("a vague opening is rejected, including a fact that lands after the first 50 words", () => {
  assert.ok(rules("Most creators burn out because they chase every trend and forget why they started posting in the first place.\n\nTakeaway: ship one format.").includes(OPENING_RULE));
  assert.ok(rules("Welcome back to the channel, today we talk about consistency and why it matters for long term growth.\n\nTakeaway: post weekly.").includes(OPENING_RULE));
  assert.ok(rules("May be the reason channels stall and never learn a format.\n\nTakeaway: pick a format.").includes(OPENING_RULE));
  assert.ok(rules("March toward a bigger audience without a plan or a number.\n\nTakeaway: pick a number.").includes(OPENING_RULE));
  assert.ok(rules(`${fluff(50)} 99\n\nTakeaway: ship one video.`).includes(OPENING_RULE));
  assert.deepEqual(rules(`${fluff(49)} 99\n\nTakeaway: ship one video.`), []);
});

test("a labeled hook is the opening, so a later fact does not save a vague hook", () => {
  const script = [
    "HOOK:",
    "Most creators guess and keep guessing for a long time.",
    "",
    "BODY:",
    "In 2024 the rate was 40%.",
    "",
    "Takeaway: measure once a week.",
  ].join("\n");
  assert.match(openingText(script), /Most creators guess/);
  assert.doesNotMatch(openingText(script), /40%/);
  assert.deepEqual(rules(script), [OPENING_RULE]);
});

test("a hook section with a fact passes even when the body is vague", () => {
  const script = [
    "HOOK:",
    "Did 40% of viewers leave before the point?",
    "",
    "BODY:",
    "Then a long vague explanation that never names a source.",
    "",
    "Takeaway: open with the number.",
  ].join("\n");
  assert.match(openingText(script), /40%/);
  assert.deepEqual(rules(script), []);
});

test("a draft with no explicit takeaway or close is rejected", () => {
  const vagueEnd = "In 2020, 70% of new channels quit.\n\nThey changed formats every week.\n\nSee you in the next one.";
  assert.deepEqual(rules(vagueEnd), [TAKEAWAY_RULE]);
  assert.ok(rules("In 2020, 70% of new channels quit.\n\nClose the tab and publish.").includes(TAKEAWAY_RULE));
});

test("an explicit takeaway or close line passes", () => {
  assert.deepEqual(
    rules("In 2020, 70% of new channels quit.\n\nTakeaway: ship five videos in one format before you change anything."),
    [],
  );
  assert.deepEqual(rules("In 2020, 70% of new channels quit.\n\nClose: publish before you add a new format."), []);
  assert.deepEqual(rules("In 2020, 70% of new channels quit.\n\nBottom line: one video a week beats a perfect plan."), []);
  assert.deepEqual(rules("In 2020, 70% of new channels quit.\n\nRemember this: the hook has to earn the next minute."), []);
  assert.deepEqual(rules("In 2024 a study of 12 channels found a pattern.\n\nOUTRO\nShip the next video this week."), []);
});

test("rejection names each failed rule", () => {
  const both = ruleRejection(scriptRuleViolations("Most creators guess and keep guessing while they chase views."));
  assert.equal(both.rules.length, 2);
  assert.match(both.error, /Rejected by hard rules/);
  assert.match(both.error, new RegExp(OPENING_RULE));
  assert.match(both.error, new RegExp(TAKEAWAY_RULE));
  assert.doesNotMatch(both.error, DASHES);

  const one = ruleRejection(scriptRuleViolations("In 2020, 70% of new channels quit.\n\nSee you next time."));
  assert.deepEqual(one.rules, [TAKEAWAY_RULE]);
  assert.match(one.error, /Rejected by hard rule/);
  assert.match(one.error, new RegExp(`"${TAKEAWAY_RULE}"`));
});

test("retry feedback names the failed rule and does not use em or en dashes", () => {
  const violations = scriptRuleViolations("Welcome back, today we talk about consistency and growth.");
  const feedback = rewriteFeedback(violations, "Welcome back, today we talk about consistency and growth.");
  const note = continuationRuleNote(violations);
  assert.match(feedback, /opening must contain a concrete fact or question/);
  assert.match(feedback, /draft must include a clear takeaway/);
  assert.match(note, /Do not restart/);
  assert.doesNotMatch(feedback, DASHES);
  assert.doesNotMatch(note, DASHES);
});

test("analytics feedback fills only the metrics that were sent", () => {
  const tail =
    "The next script must address this number. Change the hook, the packaging, or the first 30 seconds so the next video improves the weak metric. Do not ignore the number.";
  assert.equal(
    previousResultLine(4.5, 31),
    `Previous result: last video CTR was 4.5% / 30-second retention was 31%. ${tail}`,
  );
  assert.equal(previousResultLine(4.5), `Previous result: last video CTR was 4.5%. ${tail}`);
  assert.equal(previousResultLine(undefined, 31), `Previous result: 30-second retention was 31%. ${tail}`);
  assert.equal(previousResultLine(0, 0), `Previous result: last video CTR was 0% / 30-second retention was 0%. ${tail}`);
  assert.equal(previousResultLine(), null);
  assert.equal(injectPreviousResult("Write it."), "Write it.");
  assert.match(injectPreviousResult("Write it.", 2), /Previous result: last video CTR was 2%\./);
  assert.doesNotMatch(previousResultLine(2, 3) ?? "", DASHES);
});

test("lastCtr and lastRetention must be finite numbers when present", () => {
  assert.deepEqual(readOptionalFinite(undefined, "lastCtr"), { ok: true });
  assert.deepEqual(readOptionalFinite(null, "lastRetention"), { ok: true });
  assert.deepEqual(readOptionalFinite(0, "lastCtr"), { ok: true, value: 0 });
  assert.deepEqual(readOptionalFinite(12.5, "lastRetention"), { ok: true, value: 12.5 });
  assert.deepEqual(readOptionalFinite(-3, "lastCtr"), { ok: true, value: -3 });
  assert.deepEqual(readOptionalFinite("4", "lastCtr"), { ok: false, error: "lastCtr must be a finite number" });
  assert.deepEqual(readOptionalFinite(Number.NaN, "lastCtr"), { ok: false, error: "lastCtr must be a finite number" });
  assert.deepEqual(readOptionalFinite(Number.POSITIVE_INFINITY, "lastRetention"), {
    ok: false,
    error: "lastRetention must be a finite number",
  });
  assert.deepEqual(readOptionalFinite(true, "lastCtr"), { ok: false, error: "lastCtr must be a finite number" });
});

test("script rule sources do not contain em or en dashes", () => {
  for (const rel of ["app/api/ai/script/route.ts", "lib/script-rules.ts", "lib/stream-protocol.ts", "lib/anthropic.ts"]) {
    assert.doesNotMatch(readFileSync(join(root, rel), "utf8"), DASHES, rel);
  }
});
