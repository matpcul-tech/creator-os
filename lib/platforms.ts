// Platform metadata used by the studio composer, calendar, and analytics.
import type { LucideIcon } from "lucide-react";
import {
  Youtube,
  Instagram,
  Twitter,
  Linkedin,
  Mail,
  Mic,
  FileText,
  Globe,
} from "lucide-react";

export type PlatformId =
  | "youtube"
  | "youtube_shorts"
  | "tiktok"
  | "instagram"
  | "instagram_reels"
  | "x"
  | "linkedin"
  | "threads"
  | "substack"
  | "podcast"
  | "blog";

export type Platform = {
  id: PlatformId;
  name: string;
  icon: LucideIcon;
  color: string; // tailwind gradient classes
  dotColor: string;
  format:
    | "long_video"
    | "short_video"
    | "image_post"
    | "text_post"
    | "newsletter"
    | "podcast"
    | "blog";
  charLimit: number;
  titleLimit: number;
  hashtagsRecommended: number;
  hookSeconds: number;
  promptTips: string;
};

export const PLATFORMS: Record<PlatformId, Platform> = {
  youtube: {
    id: "youtube",
    name: "YouTube",
    icon: Youtube,
    color: "from-red-500 to-rose-500",
    dotColor: "bg-red-500",
    format: "long_video",
    charLimit: 5000,
    titleLimit: 100,
    hashtagsRecommended: 3,
    hookSeconds: 15,
    promptTips:
      "Hook in first 15s; structure: hook → setup → payoff → CTA. Title under 60 chars for mobile.",
  },
  youtube_shorts: {
    id: "youtube_shorts",
    name: "YouTube Shorts",
    icon: Youtube,
    color: "from-red-400 to-pink-500",
    dotColor: "bg-red-400",
    format: "short_video",
    charLimit: 100,
    titleLimit: 100,
    hashtagsRecommended: 3,
    hookSeconds: 3,
    promptTips: "Vertical 9:16. Hook in 3s, single insight, loop-friendly ending.",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    icon: Mic,
    color: "from-fuchsia-500 to-pink-500",
    dotColor: "bg-fuchsia-500",
    format: "short_video",
    charLimit: 2200,
    titleLimit: 150,
    hashtagsRecommended: 5,
    hookSeconds: 3,
    promptTips:
      "Pattern interrupt in 3s. Talk-to-camera or text-on-screen. Trending sounds boost reach.",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    icon: Instagram,
    color: "from-pink-500 to-orange-500",
    dotColor: "bg-pink-500",
    format: "image_post",
    charLimit: 2200,
    titleLimit: 125,
    hashtagsRecommended: 8,
    hookSeconds: 0,
    promptTips:
      "First line = hook (truncates at ~125 chars). Carousels outperform single images.",
  },
  instagram_reels: {
    id: "instagram_reels",
    name: "Instagram Reels",
    icon: Instagram,
    color: "from-pink-500 to-rose-500",
    dotColor: "bg-pink-500",
    format: "short_video",
    charLimit: 2200,
    titleLimit: 125,
    hashtagsRecommended: 5,
    hookSeconds: 3,
    promptTips: "Vertical 9:16. Hook visual + caption hook. Use trending audio.",
  },
  x: {
    id: "x",
    name: "X (Twitter)",
    icon: Twitter,
    color: "from-sky-500 to-blue-500",
    dotColor: "bg-sky-500",
    format: "text_post",
    charLimit: 280,
    titleLimit: 280,
    hashtagsRecommended: 1,
    hookSeconds: 0,
    promptTips:
      "First line is everything. Threads work; lead with the strongest claim.",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    color: "from-blue-600 to-blue-700",
    dotColor: "bg-blue-600",
    format: "text_post",
    charLimit: 3000,
    titleLimit: 220,
    hashtagsRecommended: 3,
    hookSeconds: 0,
    promptTips:
      "Hook → personal story → insight → ask. Line breaks every 1–2 sentences. Posts cap at 3 hashtags.",
  },
  threads: {
    id: "threads",
    name: "Threads",
    icon: Twitter,
    color: "from-slate-700 to-slate-900",
    dotColor: "bg-slate-600",
    format: "text_post",
    charLimit: 500,
    titleLimit: 500,
    hashtagsRecommended: 1,
    hookSeconds: 0,
    promptTips:
      "Conversational. Reply-bait questions perform well. Photos boost reach.",
  },
  substack: {
    id: "substack",
    name: "Substack",
    icon: Mail,
    color: "from-orange-500 to-amber-500",
    dotColor: "bg-orange-500",
    format: "newsletter",
    charLimit: 50000,
    titleLimit: 100,
    hashtagsRecommended: 0,
    hookSeconds: 0,
    promptTips:
      "Subject line is the headline. Open with a story or contrarian claim. End with a single CTA.",
  },
  podcast: {
    id: "podcast",
    name: "Podcast",
    icon: Mic,
    color: "from-purple-500 to-fuchsia-500",
    dotColor: "bg-purple-500",
    format: "podcast",
    charLimit: 5000,
    titleLimit: 100,
    hashtagsRecommended: 0,
    hookSeconds: 30,
    promptTips:
      "Cold open with the most interesting moment. Roadmap the episode. End with a question for next week.",
  },
  blog: {
    id: "blog",
    name: "Blog / Site",
    icon: FileText,
    color: "from-slate-600 to-slate-700",
    dotColor: "bg-slate-500",
    format: "blog",
    charLimit: 50000,
    titleLimit: 70,
    hashtagsRecommended: 0,
    hookSeconds: 0,
    promptTips:
      "SEO-friendly H1, intro paragraph that answers the query, scannable H2s.",
  },
};

export const PLATFORM_LIST: Platform[] = Object.values(PLATFORMS);
export const PLATFORM_FALLBACK_ICON = Globe;

export function platform(id: string): Platform | undefined {
  return PLATFORMS[id as PlatformId];
}

export function statusColor(status: string): string {
  switch (status) {
    case "idea":
      return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    case "draft":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "scheduled":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "published":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    default:
      return "bg-dark-700/50 text-dark-400 border-dark-700";
  }
}

export const STATUS_LABELS = {
  idea: "Idea",
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
} as const;

export type ContentStatus = keyof typeof STATUS_LABELS;
