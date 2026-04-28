import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { parseJSON } from "./utils";
import { PLATFORMS, type PlatformId } from "./platforms";

// Single shared client. The SDK reads ANTHROPIC_API_KEY from env automatically.
let _client: Anthropic | null = null;

export function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local — see .env.example.",
      );
    }
    _client = new Anthropic();
  }
  return _client;
}

export const MODEL = "claude-opus-4-7";

// Build a creator-aware system prompt. This block is large + stable across a
// session (only changes when the creator updates their profile/brand), so we
// mark it for ephemeral caching to slash repeat-call cost.
export async function creatorSystemPrompt(): Promise<Anthropic.TextBlockParam[]> {
  const profile = await prisma.profile.findFirst();
  const brand = await prisma.brand.findFirst();

  const platforms = parseJSON<string[]>(profile?.platforms, []);
  const taglines = parseJSON<string[]>(brand?.taglines, []);
  const voiceRules = parseJSON<string[]>(brand?.voiceRules, []);
  const doNotUse = parseJSON<string[]>(brand?.doNotUse, []);

  const platformList = platforms
    .map((p) => PLATFORMS[p as PlatformId]?.name)
    .filter(Boolean)
    .join(", ");

  const text = [
    "You are the AI core of CreatorAI — a personal operating system for an independent content creator.",
    "Your job is to make becoming a creator simple: generate ideas, write hooks, draft scripts, adapt one piece of content to many platforms, and act as a strategic editor that knows the creator's voice.",
    "",
    "## CREATOR PROFILE",
    `Name: ${profile?.name || "(not set)"}`,
    `Handle: ${profile?.handle || "(not set)"}`,
    `Niche: ${profile?.niche || "(not set)"}`,
    `Target audience: ${profile?.audience || "(not set)"}`,
    `Bio: ${profile?.bio || "(not set)"}`,
    `Active platforms: ${platformList || "(none yet)"}`,
    `Cadence goal: ${profile?.weeklyCadence ?? 3} posts/week`,
    `Goals: ${profile?.goals || "(not set)"}`,
    "",
    "## VOICE",
    `Voice description: ${profile?.voice || "(not set — infer a balanced, conversational, expert tone)"}`,
    voiceRules.length
      ? "Voice rules:\n" + voiceRules.map((r) => `- ${r}`).join("\n")
      : "",
    doNotUse.length ? "Avoid these words/phrases: " + doNotUse.join(", ") : "",
    taglines.length ? "Brand taglines for reference: " + taglines.join(" | ") : "",
    "",
    "## PRINCIPLES",
    "- Hooks come first. Every piece of content must earn the next 3 seconds.",
    "- One idea per piece. Specificity beats breadth.",
    "- Match the platform's native format. Don't paste a YouTube description into a TikTok caption.",
    "- Avoid generic AI-sounding phrasing (\"in today's fast-paced world\", \"unlock the power of\", em-dashes used as throat-clearing).",
    "- Be concrete. Use numbers, names, and specific examples over abstractions.",
    "- Respect platform character limits exactly when the user names a target platform.",
    "",
    "## OUTPUT",
    "When asked for structured output (ideas, variants, etc.), return strict JSON matching the schema given in the user message. Otherwise respond in plain prose.",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      type: "text",
      text,
      cache_control: { type: "ephemeral" },
    },
  ];
}

// Wraps messages.create with our defaults (Opus 4.7 + adaptive thinking) and
// the cached system prompt. Returns the first text block's content.
export async function complete(opts: {
  user: string;
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}): Promise<string> {
  const system = await creatorSystemPrompt();

  const params: Anthropic.MessageCreateParams = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system,
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "high" },
    messages: [{ role: "user", content: opts.user }],
  };

  if (opts.jsonSchema) {
    params.output_config = {
      ...(params.output_config ?? {}),
      format: { type: "json_schema", schema: opts.jsonSchema },
    };
  }

  const response = await client().messages.create(params);

  const text = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  return text?.text ?? "";
}

// Streaming version — used by the studio and ideas pages for live feedback.
export async function streamCompletion(opts: {
  user: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}): Promise<ReadableStream<Uint8Array>> {
  const system = await creatorSystemPrompt();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = client().messages.stream({
          model: MODEL,
          max_tokens: opts.maxTokens ?? 8000,
          system,
          thinking: { type: "adaptive" },
          output_config: { effort: opts.effort ?? "high" },
          messages: [{ role: "user", content: opts.user }],
        });

        stream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await stream.finalMessage();
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
        controller.close();
      }
    },
  });
}
