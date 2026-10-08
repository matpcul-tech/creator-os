import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DONE_MARKER,
  ERROR_MARKER,
  continuationMessages,
  joinContinuation,
  readStream,
  shouldContinue,
} from "../lib/stream-protocol";

test("a finished stream reads as done with the marker removed", () => {
  const s = readStream(`Line one.\n\nLine two.${DONE_MARKER}`);
  assert.deepEqual(s, { text: "Line one.\n\nLine two.", done: true, error: null });
});

test("a stream with an error marker keeps the text and the message", () => {
  const s = readStream(`Line one.${ERROR_MARKER} The writer stopped early.`);
  assert.equal(s.text, "Line one.");
  assert.equal(s.done, false);
  assert.equal(s.error, "The writer stopped early.");
});

test("a stream with no marker is not done, so the browser offers Continue", () => {
  const s = readStream("Line one.\n\nLine tw");
  assert.equal(s.done, false);
  assert.equal(s.error, null);
  assert.equal(s.text, "Line one.\n\nLine tw");
});

test("a half arrived marker is hidden from the draft", () => {
  assert.equal(readStream("Line one.\n[[cai:do").text, "Line one.");
});

test("auto continue only on max_tokens and only a few rounds", () => {
  assert.equal(shouldContinue("max_tokens", 0), true);
  assert.equal(shouldContinue("max_tokens", 2), true);
  assert.equal(shouldContinue("max_tokens", 3), false);
  assert.equal(shouldContinue("end_turn", 0), false);
  assert.equal(shouldContinue(null, 0), false);
});

test("continuation sends the ask, the text so far, and a nudge", () => {
  const msgs = continuationMessages("Write a script", "Line one.\n\n");
  assert.equal(msgs.length, 3);
  assert.equal(msgs[1].role, "assistant");
  assert.equal(msgs[1].content, "Line one.");
  assert.equal(msgs[2].role, "user");
  assert.deepEqual(continuationMessages("Write a script", ""), [{ role: "user", content: "Write a script" }]);
});

test("joining drops the words the model repeated", () => {
  const prev = "Most creators quit too early.\n\nThe ones who win keep going after";
  assert.equal(
    joinContinuation(prev, "who win keep going after the first month.\n\nThat is the secret."),
    "Most creators quit too early.\n\nThe ones who win keep going after the first month.\n\nThat is the secret.",
  );
});

test("joining tolerates different spacing in the repeated words", () => {
  const prev = "Line one.\n\nWe keep  going after";
  assert.equal(joinContinuation(prev, "We keep going after the first month."), "Line one.\n\nWe keep  going after the first month.");
});

test("joining without overlap adds a line break after a full sentence", () => {
  assert.equal(joinContinuation("Line one.", "Line two."), "Line one.\n\nLine two.");
  assert.equal(joinContinuation("Line one and", "then two."), "Line one and then two.");
});
