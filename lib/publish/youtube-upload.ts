// YouTube upload from the browser using a short-lived access token from
// /api/youtube/token. The video goes straight from the browser to Google,
// which avoids Vercel's request size limit. fetchImpl is injectable for tests.

import type { FetchLike } from "./youtube-oauth";

const UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3";

export type YouTubePrivacy = "private" | "unlisted" | "public";

export function youtubeMetadata(opts: {
  title: string;
  description: string;
  tags?: string[];
  privacyStatus: YouTubePrivacy;
}) {
  return {
    snippet: {
      title: opts.title.trim().slice(0, 100) || "Untitled",
      description: opts.description.slice(0, 5000),
      tags: (opts.tags ?? []).slice(0, 15),
      categoryId: "22", // People & Blogs
    },
    status: {
      privacyStatus: opts.privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };
}

// Resumable upload: 1) start a session with the metadata, 2) PUT the bytes.
export async function uploadYouTubeVideo(
  opts: {
    accessToken: string;
    video: Blob;
    title: string;
    description: string;
    tags?: string[];
    privacyStatus: YouTubePrivacy;
  },
  fetchImpl: FetchLike = fetch,
): Promise<{ videoId: string; url: string }> {
  const start = await fetchImpl(`${UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": opts.video.type || "video/mp4",
      "X-Upload-Content-Length": String(opts.video.size),
    },
    body: JSON.stringify(youtubeMetadata(opts)),
  });
  if (!start.ok) throw new Error(`YouTube didn't accept the upload (${start.status}).`);
  const sessionUrl = start.headers.get("Location") || start.headers.get("location");
  if (!sessionUrl) throw new Error("YouTube didn't return an upload address.");

  const put = await fetchImpl(sessionUrl, {
    method: "PUT",
    headers: { "Content-Type": opts.video.type || "video/mp4" },
    body: opts.video,
  });
  const json = (await put.json().catch(() => ({}))) as { id?: string };
  if (!put.ok || !json.id) throw new Error(`The video upload failed (${put.status}).`);
  return { videoId: json.id, url: `https://youtu.be/${json.id}` };
}

// thumbnails.set. Needs a verified channel on YouTube's side.
export async function setYouTubeThumbnail(
  opts: { accessToken: string; videoId: string; image: Blob },
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const res = await fetchImpl(
    `${UPLOAD_BASE}/thumbnails/set?videoId=${encodeURIComponent(opts.videoId)}&uploadType=media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": opts.image.type || "image/png",
      },
      body: opts.image,
    },
  );
  if (!res.ok) throw new Error(`The thumbnail was not set (${res.status}). The video is uploaded.`);
}
