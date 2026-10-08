// Unit tests for the YouTube connector. All network calls are mocked.
// Nothing is ever posted. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthUrl,
  exchangeCode,
  needsRefresh,
  refreshAccessToken,
  YOUTUBE_SCOPES,
  type FetchLike,
} from "../lib/publish/youtube-oauth";
import { setYouTubeThumbnail, uploadYouTubeVideo, youtubeMetadata } from "../lib/publish/youtube-upload";
import { decryptSecret, encryptSecret } from "../lib/crypto-box";

type Call = { url: string; init?: RequestInit };

function mockFetch(responses: Response[]): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error(`Unexpected fetch to ${url}`);
      return next;
    },
  };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

test("auth URL asks for offline upload access with state", () => {
  const url = new URL(buildAuthUrl({ clientId: "cid", redirectUri: "https://app.test/api/youtube/callback", state: "s123" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), "cid");
  assert.equal(url.searchParams.get("redirect_uri"), "https://app.test/api/youtube/callback");
  assert.equal(url.searchParams.get("scope"), YOUTUBE_SCOPES.join(" "));
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "s123");
});

test("exchangeCode posts the code and maps the token response", async () => {
  const m = mockFetch([json({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "s" })]);
  const now = 1_000_000;
  const t = await exchangeCode({ code: "c", clientId: "id", clientSecret: "sec", redirectUri: "https://r" }, m.fetch, now);
  assert.equal(m.calls[0].url, "https://oauth2.googleapis.com/token");
  const body = new URLSearchParams(String(m.calls[0].init?.body));
  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(body.get("code"), "c");
  assert.equal(body.get("redirect_uri"), "https://r");
  assert.deepEqual(t, { accessToken: "at", refreshToken: "rt", expiresAt: new Date(now + 3_600_000), scope: "s" });
});

test("exchangeCode surfaces Google errors", async () => {
  const m = mockFetch([json({ error: "invalid_grant" }, 400)]);
  await assert.rejects(
    exchangeCode({ code: "bad", clientId: "id", clientSecret: "sec", redirectUri: "https://r" }, m.fetch),
    /invalid_grant/,
  );
});

test("refreshAccessToken uses the refresh_token grant", async () => {
  const m = mockFetch([json({ access_token: "new", expires_in: 100 })]);
  const r = await refreshAccessToken({ refreshToken: "rt", clientId: "id", clientSecret: "sec" }, m.fetch, 0);
  const body = new URLSearchParams(String(m.calls[0].init?.body));
  assert.equal(body.get("grant_type"), "refresh_token");
  assert.equal(body.get("refresh_token"), "rt");
  assert.equal(r.accessToken, "new");
  assert.equal(r.expiresAt.getTime(), 100_000);
});

test("needsRefresh is true near expiry", () => {
  assert.equal(needsRefresh(null, 0), true);
  assert.equal(needsRefresh(new Date(60_000), 0), true);
  assert.equal(needsRefresh(new Date(600_000), 0), false);
});

test("metadata trims the title and keeps the privacy setting", () => {
  const m = youtubeMetadata({ title: "x".repeat(150), description: "d", privacyStatus: "private" });
  assert.equal(m.snippet.title.length, 100);
  assert.equal(m.status.privacyStatus, "private");
  assert.equal(m.status.selfDeclaredMadeForKids, false);
});

test("upload starts a resumable session, then PUTs the bytes", async () => {
  const m = mockFetch([
    new Response(null, { status: 200, headers: { Location: "https://upload.test/session/1" } }),
    json({ id: "vid123" }),
  ]);
  const video = new Blob([new Uint8Array([1, 2, 3])], { type: "video/mp4" });
  const r = await uploadYouTubeVideo(
    { accessToken: "at", video, title: "T", description: "D", privacyStatus: "unlisted" },
    m.fetch,
  );
  assert.deepEqual(r, { videoId: "vid123", url: "https://youtu.be/vid123" });
  assert.match(m.calls[0].url, /upload\/youtube\/v3\/videos\?uploadType=resumable&part=snippet,status/);
  const h0 = m.calls[0].init?.headers as Record<string, string>;
  assert.equal(h0.Authorization, "Bearer at");
  assert.equal(h0["X-Upload-Content-Length"], "3");
  assert.equal(JSON.parse(String(m.calls[0].init?.body)).status.privacyStatus, "unlisted");
  assert.equal(m.calls[1].url, "https://upload.test/session/1");
  assert.equal(m.calls[1].init?.method, "PUT");
});

test("upload fails clearly when YouTube rejects the session", async () => {
  const m = mockFetch([json({ error: { code: 403 } }, 403)]);
  await assert.rejects(
    uploadYouTubeVideo({ accessToken: "at", video: new Blob(["x"]), title: "T", description: "", privacyStatus: "private" }, m.fetch),
    /didn't accept the upload \(403\)/,
  );
});

test("thumbnail is posted to thumbnails.set for the video", async () => {
  const m = mockFetch([json({ items: [] })]);
  await setYouTubeThumbnail({ accessToken: "at", videoId: "v1", image: new Blob(["png"], { type: "image/png" }) }, m.fetch);
  assert.match(m.calls[0].url, /thumbnails\/set\?videoId=v1/);
  assert.equal((m.calls[0].init?.headers as Record<string, string>)["Content-Type"], "image/png");
});

test("tokens are encrypted at rest and decrypt back", () => {
  process.env.APP_SESSION_SECRET = "test-secret-at-least-16-chars";
  const box = encryptSecret("ya29.token");
  assert.notEqual(box, "ya29.token");
  assert.ok(!box.includes("ya29"));
  assert.equal(decryptSecret(box), "ya29.token");
  // Always change one character of the auth tag, so the tampered box really differs.
  const parts = box.split(".");
  parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
  const tampered = parts.join(".");
  assert.throws(() => decryptSecret(tampered));
});
