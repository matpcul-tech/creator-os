// User-message templates for the AI features. Kept separate from the system
// prompt so that the system prompt remains stable + cacheable across calls.

import { PLATFORMS, type PlatformId } from "./platforms";

export function ideaBatchPrompt(opts: { count: number; topic?: string }) {
  return `Generate ${opts.count} content ideas${
    opts.topic ? ` related to: "${opts.topic}"` : ""
  }.

For each idea, return:
- title: a concrete, specific title (no clickbait — accurate)
- hook: the first line a viewer/reader would see (≤ 100 chars)
- angle: one sentence on why this is worth making
- platform: which single platform suits it best (youtube | youtube_shorts | tiktok | instagram | instagram_reels | x | linkedin | threads | substack | podcast | blog | any)
- tags: 2–5 short topical tags
- score: integer 1–10 (your honest rating of how strong this idea is for this creator)

Return strict JSON: { "ideas": [ { "title": "...", "hook": "...", "angle": "...", "platform": "...", "tags": ["..."], "score": 8 } ] }`;
}

export const ideaBatchSchema = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          hook: { type: "string" },
          angle: { type: "string" },
          platform: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          score: { type: "integer" },
        },
        required: ["title", "hook", "angle", "platform", "tags", "score"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
} as const;

export function scriptPrompt(opts: {
  title: string;
  platform: PlatformId;
  context?: string;
}) {
  const p = PLATFORMS[opts.platform];
  const formatHints: Record<string, string> = {
    long_video: `Long-form YouTube video script. Include sections: HOOK (first ${p.hookSeconds}s, on screen + spoken), SETUP, MAIN CONTENT (3–5 beats), PAYOFF, CTA. Format with clear section headers.`,
    short_video: `Short-form vertical script (TikTok/Reels/Shorts). Include: HOOK (first 3s, both visual and verbal), 3 BEATS, OUTRO. Aim for 30–60 seconds total. Format with clear headers.`,
    image_post: `Caption + carousel slide outline. Format: CAPTION (first line is the hook), then 6–8 SLIDE OUTLINES each 1–2 lines.`,
    text_post: `Native ${p.name} post. Lead with the strongest hook. ${p.charLimit} char ceiling — stay under it. Use line breaks every 1–2 sentences for readability.`,
    newsletter: `Newsletter draft. Format: SUBJECT LINE (test 3 versions), OPENING (hook), BODY (3 main sections with H2 headers), CTA, P.S.`,
    podcast: `Podcast script outline. Format: COLD OPEN (most interesting quote/moment), INTRO, 4–6 SEGMENTS with talking points, OUTRO with question for next ep.`,
    blog: `Blog post draft. Format: H1, INTRO (answer the query in para 1), 4–6 H2 SECTIONS with supporting paragraphs, CONCLUSION with takeaway.`,
  };

  return `Write a ${p.name} script for the following idea.

Title: ${opts.title}
Platform: ${p.name}
Platform tips: ${p.promptTips}
Format: ${formatHints[p.format]}
${opts.context ? `\nAdditional context from the creator:\n${opts.context}` : ""}

Write the script directly — no preamble, no meta-commentary.`;
}

export function adaptPrompt(opts: { master: string; targets: PlatformId[] }) {
  const lines = opts.targets
    .map((id) => {
      const p = PLATFORMS[id];
      return `- ${id} ("${p.name}"): ${p.charLimit} char limit, format: ${p.format}, ${p.promptTips}`;
    })
    .join("\n");

  return `Adapt this master content into platform-native versions for each target. Each variant must respect the platform's character limit, format, and conventions exactly. Don't paste the same text across platforms — rewrite for the medium.

Target platforms:
${lines}

Master content:
"""
${opts.master}
"""

Return strict JSON: { "variants": { "${opts.targets.join('": "...", "')}": "..." } }`;
}

export function adaptSchema(targets: PlatformId[]) {
  return {
    type: "object",
    properties: {
      variants: {
        type: "object",
        properties: Object.fromEntries(
          targets.map((t) => [t, { type: "string" }]),
        ),
        required: targets,
        additionalProperties: false,
      },
    },
    required: ["variants"],
    additionalProperties: false,
  };
}

export function hookBatchPrompt(opts: { topic: string; count: number; platform?: PlatformId }) {
  return `Generate ${opts.count} hooks for content about: "${opts.topic}".${
    opts.platform ? ` Platform: ${PLATFORMS[opts.platform].name}.` : ""
  }

A hook is the first line that earns the next 3 seconds of attention. Mix these formats:
- Curiosity gap ("Most creators do X. The top 1% do Y.")
- Contrarian claim ("Stop trying to go viral. Here's what works instead.")
- Specific number ("847 tweets later, here's what I learned.")
- Question ("Why do most newsletters die at 100 subscribers?")
- Personal story open ("Last year I quit my job to make TikToks. Here's what I'd do differently.")

Return strict JSON: { "hooks": ["...", "...", ...] }`;
}

export const hookBatchSchema = {
  type: "object",
  properties: {
    hooks: { type: "array", items: { type: "string" } },
  },
  required: ["hooks"],
  additionalProperties: false,
} as const;

export function brandVoicePrompt(opts: { samples: string }) {
  return `Analyze these content samples to extract this creator's brand voice DNA.

Samples:
"""
${opts.samples}
"""

Return strict JSON with:
- traits: array of 5 voice traits with strength 0–100. Trait labels should be one or two words (e.g., "Conversational", "Data-Driven", "Witty", "Direct", "Warm", "Analytical").
- keywords: array of 8–12 short signature words/phrases this creator uses (1–4 words each).
- voice_description: 1–2 sentences describing the voice in plain language.
- do_not_use: array of 4–8 words/phrases that would NOT sound like this creator (especially generic AI cliches).
- example_good: a single 2–3 sentence example written in this voice on the topic of "starting out as a creator".
- example_bad: the same topic written in generic AI voice (for comparison).

Return strict JSON: { "traits": [...], "keywords": [...], "voice_description": "...", "do_not_use": [...], "example_good": "...", "example_bad": "..." }`;
}

export const brandVoiceSchema = {
  type: "object",
  properties: {
    traits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          trait: { type: "string" },
          strength: { type: "integer" },
        },
        required: ["trait", "strength"],
        additionalProperties: false,
      },
    },
    keywords: { type: "array", items: { type: "string" } },
    voice_description: { type: "string" },
    do_not_use: { type: "array", items: { type: "string" } },
    example_good: { type: "string" },
    example_bad: { type: "string" },
  },
  required: ["traits", "keywords", "voice_description", "do_not_use", "example_good", "example_bad"],
  additionalProperties: false,
} as const;

export function thumbnailPrompt(opts: { title: string }) {
  return `Generate 3 thumbnail concepts for the video titled: "${opts.title}".

For each concept, describe:
- visual: the main image/scene
- text_overlay: 2–6 words of bold text on the thumbnail
- style: color palette, expression, composition

Return strict JSON: { "concepts": [ { "visual": "...", "text_overlay": "...", "style": "..." } ] }`;
}
