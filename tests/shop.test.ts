import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importProducts, num, parseCsv, scoreProducts, priceFit } from "../lib/shop/products";
import { DISCLOSURE, finalize, postCaption, spokenSegments, spokenSeconds, templateScript, MAX_SECONDS } from "../lib/shop/video";

test("csv parser handles quotes and commas", () => {
  const rows = parseCsv('a,b\n"x, y","he said ""hi"""\n');
  assert.deepEqual(rows, [["a", "b"], ["x, y", 'he said "hi"']]);
});

test("number parsing", () => {
  assert.equal(num("$1,234.50"), 1234.5);
  assert.equal(num("12.5%"), 12.5);
  assert.equal(num("1.2k"), 1200);
  assert.equal(num("10-20"), 15);
});

test("sample csv imports and ranks", () => {
  const text = readFileSync("public/samples/tiktok-shop-example-products.csv", "utf8");
  const { products, missing } = importProducts(text);
  assert.equal(missing.length, 0);
  assert.equal(products.length, 12);
  const ranked = scoreProducts(products);
  assert.ok(ranked[0].score >= ranked[ranked.length - 1].score);
  assert.ok(ranked.every((p) => p.score >= 0 && p.score <= 100));
  assert.ok(ranked.every((p) => p.name.startsWith("EXAMPLE DATA")));
});

test("alternate headers (Kalodata style) and decimal commission", () => {
  const { products } = importProducts("Product Title,Avg Price,Commission,Sales (7d),Affiliates\nWidget,$20,0.15,700,10\n");
  assert.equal(products[0].commission, 15);
  assert.equal(products[0].velocity, 100);
});

test("price fit favors 15 to 60", () => {
  assert.equal(priceFit(30), 1);
  assert.ok(priceFit(5) < 0.5);
  assert.ok(priceFit(150) < 0.5);
});

test("script always ends with disclosure, has no dashes, fits under 60s", () => {
  const s = templateScript({ name: "EXAMPLE DATA - Neck Fan", price: 24.99, benefits: "Quiet \u2014 really quiet. Lasts all day" });
  const segs = spokenSegments(s);
  assert.equal(segs[segs.length - 1], `${DISCLOSURE}.`);
  assert.ok(!/[\u2013\u2014]/.test(segs.join(" ") + postCaption(s)));
  assert.ok(postCaption(s).includes(DISCLOSURE));
  assert.ok(s.hashtags.includes("#ad"));
  const long = finalize({ ...s, lines: Array(40).fill("this is a fairly long line of spoken words for testing purposes") });
  assert.ok(spokenSeconds(long) <= MAX_SECONDS);
});
