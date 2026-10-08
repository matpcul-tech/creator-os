import { test } from "node:test";
import assert from "node:assert/strict";
import { isLikelyPhoto } from "../lib/cut/photo-filter";

const photo = { mime: "image/jpeg", width: 4000, height: 3000 };

test("keeps ordinary photographs", () => {
  assert.equal(isLikelyPhoto({ title: "File:Hands holding a smartphone.jpg", ...photo }), true);
  assert.equal(isLikelyPhoto({ title: "File:DSC 0042.jpg", ...photo, categories: "Smartphones|Hands" }), true);
});

test("drops screenshots, diagrams, maps, logos, and SVGs", () => {
  assert.equal(isLikelyPhoto({ title: "File:Wikipedia mobile app screenshot.jpg", ...photo }), false);
  assert.equal(isLikelyPhoto({ title: "File:Phone.jpg", ...photo, categories: "Screenshots of Android" }), false);
  assert.equal(isLikelyPhoto({ title: "File:Battery diagram.jpg", ...photo }), false);
  assert.equal(isLikelyPhoto({ title: "File:Map of Texas.jpg", ...photo }), false);
  assert.equal(isLikelyPhoto({ title: "File:Company logo.jpg", ...photo }), false);
  assert.equal(isLikelyPhoto({ title: "File:Phone.svg", mime: "image/svg+xml", width: 800, height: 800 }), false);
  assert.equal(isLikelyPhoto({ title: "File:Phone.png", mime: "image/png", width: 800, height: 800 }), false);
});

test("drops tiny images and extreme strips", () => {
  assert.equal(isLikelyPhoto({ title: "File:Phone.jpg", mime: "image/jpeg", width: 300, height: 200 }), false);
  assert.equal(isLikelyPhoto({ title: "File:Skyline.jpg", mime: "image/jpeg", width: 9000, height: 1500 }), false);
});

test("photos of screens rank below other photos", async () => {
  const { photoBonus } = await import("../lib/cut/photo-filter");
  const screen = photoBonus({ title: "File:Hand holding Smartphone.jpg", categories: "Taken with Nokia 7.2|Front of smartphones" });
  const plain = photoBonus({ title: "File:Hand holding Smartphone in park.jpg", categories: "Taken with Canon|Hands" });
  assert.ok(screen < plain);
});
