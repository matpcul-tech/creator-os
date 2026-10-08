// Publishing connectors. "api" connectors post for real. "share" connectors
// give a share kit (copy caption, download files, open the upload page) until
// a real API connector is added. To add one later, flip mode to "api" and
// handle the id in components/PostFlow.tsx postNow().

import type { PlatformId } from "@/lib/platforms";

export type ConnectorMode = "api" | "share";

export type Connector = {
  id: PlatformId;
  name: string;
  mode: ConnectorMode;
  uploadUrl: string;
  video: boolean; // expects a video file
  captionLimit: number;
  note?: string;
};

export const CONNECTORS: Partial<Record<PlatformId, Connector>> = {
  youtube: { id: "youtube", name: "YouTube", mode: "api", uploadUrl: "https://studio.youtube.com/", video: true, captionLimit: 5000 },
  youtube_shorts: { id: "youtube_shorts", name: "YouTube Shorts", mode: "api", uploadUrl: "https://studio.youtube.com/", video: true, captionLimit: 5000, note: "Uploaded through the YouTube connection. Vertical videos under 3 minutes show as Shorts." },
  tiktok: { id: "tiktok", name: "TikTok", mode: "share", uploadUrl: "https://www.tiktok.com/upload", video: true, captionLimit: 2200, note: "TikTok's posting API needs app review." },
  instagram: { id: "instagram", name: "Instagram", mode: "share", uploadUrl: "https://www.instagram.com/", video: true, captionLimit: 2200, note: "Instagram posting needs a Meta business app and review." },
  instagram_reels: { id: "instagram_reels", name: "Instagram Reels", mode: "share", uploadUrl: "https://www.instagram.com/", video: true, captionLimit: 2200, note: "Instagram posting needs a Meta business app and review." },
  x: { id: "x", name: "X", mode: "share", uploadUrl: "https://x.com/compose/post", video: true, captionLimit: 280, note: "X's posting API is a paid tier." },
  linkedin: { id: "linkedin", name: "LinkedIn", mode: "share", uploadUrl: "https://www.linkedin.com/feed/?shareActive=true", video: true, captionLimit: 3000, note: "LinkedIn posting needs app review." },
  threads: { id: "threads", name: "Threads", mode: "share", uploadUrl: "https://www.threads.net/", video: true, captionLimit: 500, note: "Threads posting needs a Meta app and review." },
};

export function connectorFor(id: string): Connector | null {
  return CONNECTORS[id as PlatformId] ?? null;
}
