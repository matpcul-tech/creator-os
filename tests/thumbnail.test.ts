import test from "node:test";
import assert from "node:assert/strict";
import { renderThumbnailPng, thumbnailSvg } from "../lib/thumbnail/card";

test("channel thumbnail is 1280x720 and a 1080x1920 cover", () => {
  const wide = thumbnailSvg("YOUR GPU IS COLLATERAL", "youtube");
  assert.match(wide, /#0B1F33/);
  assert.match(wide, /#F2A900/);
  assert.match(wide, /#F4F1EA/);
  assert.match(wide, /Inter Black/);
  assert.match(wide, /COLLATERAL/);
  assert.match(wide, />LIEN</);
  assert.doesNotMatch(wide, /DejaVu|Arial/);
  const widePng = renderThumbnailPng("YOUR GPU IS COLLATERAL", "youtube");
  assert.equal(widePng.readUInt32BE(16), 1280);
  assert.equal(widePng.readUInt32BE(20), 720);

  const tall = renderThumbnailPng("YOUR GPU IS COLLATERAL", "vertical");
  assert.equal(tall.readUInt32BE(16), 1080);
  assert.equal(tall.readUInt32BE(20), 1920);
});
