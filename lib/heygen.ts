// HeyGen integration. Turns a script into a talking-head video using the
// creator's own cloned avatar (digital twin or photo avatar) and cloned voice.
//
// Generation is async: submit a render, get a videoId, then poll status until
// it is "completed" (video_url is ready) or "failed".
//
// We use the v3 API for generation and status, and v2 for listing avatars and
// voices. v1/v2 stay supported through Oct 31 2026; v3 is the recommended path.
//
// Set HEYGEN_API_KEY in env. The creator's avatar/voice ids live on Profile
// (heygenAvatarId, heygenVoiceId) and are captured once during setup.

const BASE = "https://api.heygen.com";

// Avatar V gives strong character consistency at the standard rate (~$1/min).
// Override per render if you want the higher-realism Avatar IV (~$4/min).
export type HeyGenEngine = "avatar_v" | "avatar_iv";

export type RenderStatus = "generating" | "completed" | "failed" | "pending";

export type RenderResult = {
  videoId: string;
  status: RenderStatus;
};

export type VideoStatus = {
  status: RenderStatus;
  url: string;
  thumbnailUrl: string;
  durationSeconds: number;
  error: string;
};

export type AvatarOption = { id: string; name: string; previewUrl: string };
export type VoiceOption = { id: string; name: string; language: string };

function apiKey(): string {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    throw new Error(
      "HEYGEN_API_KEY is not set. Add it to .env.local, see .env.example.",
    );
  }
  return key;
}

function headers(): HeadersInit {
  return {
    "X-Api-Key": apiKey(),
    "Content-Type": "application/json",
  };
}

// Map HeyGen's various status strings onto our small set.
function normalizeStatus(raw: string): RenderStatus {
  const s = (raw || "").toLowerCase();
  if (s === "completed" || s === "complete" || s === "success") return "completed";
  if (s === "failed" || s === "error") return "failed";
  if (s === "pending" || s === "waiting") return "pending";
  return "generating";
}

// Submit a render. Returns the videoId to poll.
export async function renderAvatarVideo(opts: {
  script: string;
  avatarId: string;
  voiceId: string;
  title?: string;
  engine?: HeyGenEngine;
}): Promise<RenderResult> {
  const { script, avatarId, voiceId, title, engine = "avatar_v" } = opts;

  if (!script.trim()) throw new Error("script is empty");
  if (!avatarId) throw new Error("avatarId is missing (set it up in integrations)");
  if (!voiceId) throw new Error("voiceId is missing (set it up in integrations)");

  const res = await fetch(`${BASE}/v3/videos`, {
    method: "POST",
    headers: headers(),
    cache: "no-store",
    body: JSON.stringify({
      type: "avatar",
      avatar_id: avatarId,
      voice_id: voiceId,
      engine: { type: engine },
      script,
      ...(title ? { title } : {}),
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || `HeyGen ${res.status}`;
    throw new Error(msg);
  }

  const data = json?.data ?? json;
  const videoId: string = data?.video_id ?? data?.id ?? "";
  if (!videoId) throw new Error("HeyGen did not return a video_id");

  return { videoId, status: normalizeStatus(data?.status ?? "generating") };
}

// Poll a render. When status is "completed", url holds the MP4.
export async function getVideoStatus(videoId: string): Promise<VideoStatus> {
  const res = await fetch(`${BASE}/v3/videos/${videoId}`, {
    method: "GET",
    headers: headers(),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || `HeyGen ${res.status}`;
    throw new Error(msg);
  }

  const data = json?.data ?? json;
  return {
    status: normalizeStatus(data?.status ?? ""),
    url: data?.video_url ?? data?.url ?? "",
    thumbnailUrl: data?.thumbnail_url ?? "",
    durationSeconds: Number(data?.duration ?? 0),
    error: data?.error?.message ?? data?.error ?? "",
  };
}

// List the creator's available avatars (their digital twins show up here once
// created in the HeyGen dashboard).
export async function listAvatars(): Promise<AvatarOption[]> {
  const res = await fetch(`${BASE}/v2/avatars`, {
    method: "GET",
    headers: headers(),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `HeyGen ${res.status}`);

  const data = json?.data ?? {};
  const avatars = [
    ...(Array.isArray(data?.avatars) ? data.avatars : []),
    ...(Array.isArray(data?.talking_photos) ? data.talking_photos : []),
  ];
  return avatars.map((a: Record<string, unknown>) => ({
    id: String(a.avatar_id ?? a.talking_photo_id ?? a.id ?? ""),
    name: String(a.avatar_name ?? a.talking_photo_name ?? a.name ?? "Avatar"),
    previewUrl: String(a.preview_image_url ?? a.preview_url ?? ""),
  }));
}

// List voices (the creator's cloned voice appears here after cloning).
export async function listVoices(): Promise<VoiceOption[]> {
  const res = await fetch(`${BASE}/v2/voices`, {
    method: "GET",
    headers: headers(),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `HeyGen ${res.status}`);

  const data = json?.data ?? {};
  const voices = Array.isArray(data?.voices) ? data.voices : [];
  return voices.map((v: Record<string, unknown>) => ({
    id: String(v.voice_id ?? v.id ?? ""),
    name: String(v.name ?? "Voice"),
    language: String(v.language ?? ""),
  }));
}
