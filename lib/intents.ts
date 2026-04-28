// Web intents: platform-native compose URLs that pre-fill content.
// For platforms that don't accept text via URL, we fall back to
// "copy to clipboard + open the platform's compose page" — the standard
// pattern used by Buffer / Tweet Hunter / Hypefury, etc.

import type { PlatformId } from "./platforms";

export type IntentMode = "intent" | "copy_open";

export type Intent = {
  /** "intent" = one-click pre-fill works. "copy_open" = copy text + open page. */
  mode: IntentMode;
  /** URL to open. */
  url: string;
  /** Text to copy to clipboard (for copy_open mode). */
  text: string;
  /** Human label e.g. "Open in X" / "Copy & open IG". */
  label: string;
  /** Helpful caption shown next to the button. */
  hint: string;
};

const enc = encodeURIComponent;

export function buildIntent(
  platform: PlatformId,
  text: string,
): Intent {
  switch (platform) {
    case "x":
      // X accepts text via the intent URL — true one-click pre-fill.
      return {
        mode: "intent",
        url: `https://twitter.com/intent/tweet?text=${enc(text)}`,
        text,
        label: "Open in X",
        hint: "One-click — text pre-fills in the X composer.",
      };

    case "threads":
      // Threads has no documented web intent; copy + open compose page.
      return {
        mode: "copy_open",
        url: "https://www.threads.net/",
        text,
        label: "Copy & open Threads",
        hint: "Text copied. Tap the + button on Threads and paste.",
      };

    case "linkedin":
      // LinkedIn's share-offsite endpoint only accepts a URL, not free text.
      // Best UX: copy the post text, open the LinkedIn feed compose modal.
      return {
        mode: "copy_open",
        url: "https://www.linkedin.com/feed/?shareActive=true",
        text,
        label: "Copy & open LinkedIn",
        hint: "Text copied. Paste into the share dialog that opens.",
      };

    case "substack":
      return {
        mode: "copy_open",
        url: "https://substack.com/publish",
        text,
        label: "Copy & open Substack",
        hint: "Text copied. Paste into a new Substack post.",
      };

    case "instagram":
    case "instagram_reels":
      // Instagram has no web composer for posts/reels — copy is the only option.
      return {
        mode: "copy_open",
        url: "https://www.instagram.com/",
        text,
        label: "Copy caption & open IG",
        hint: "Caption copied. Upload your media in the IG app and paste.",
      };

    case "tiktok":
      return {
        mode: "copy_open",
        url: "https://www.tiktok.com/upload",
        text,
        label: "Copy caption & open TikTok",
        hint: "Caption copied. Upload your video on tiktok.com/upload.",
      };

    case "youtube":
      return {
        mode: "copy_open",
        url: "https://studio.youtube.com/",
        text,
        label: "Copy & open YT Studio",
        hint: "Description copied. Paste into YouTube Studio.",
      };

    case "youtube_shorts":
      return {
        mode: "copy_open",
        url: "https://studio.youtube.com/",
        text,
        label: "Copy & open YT Studio",
        hint: "Description copied. Paste into your Shorts upload.",
      };

    case "blog":
      return {
        mode: "copy_open",
        url: "",
        text,
        label: "Copy markdown",
        hint: "Body copied as-is for paste into your CMS.",
      };

    default:
      return {
        mode: "copy_open",
        url: "",
        text,
        label: "Copy text",
        hint: "Text copied to clipboard.",
      };
  }
}
