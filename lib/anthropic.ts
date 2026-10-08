import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { parseJSON } from "./utils";
import { PLATFORMS, type PlatformId } from "./platforms";
import { DONE_MARKER, ERROR_MARKER, continuationMessages, joinContinuation, shouldContinue } from "./stream-protocol";
import {
  AI_MODELS,
  BudgetExceededError,
  DEFAULT_EFFORT,
  assertWithinBudget,
  estimateCostUsd,
  recordUsage,
  type Effort,
  type ModelTier,
} from "./ai-budget";

// Single shared client. The SDK reads ANTHROPIC_API_KEY from env automatically.
let _client: Anthropic | null = null;

export function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      // Shown to the user, so keep it friendly. Setup details live in .env.example.
      throw new Error("AI writing isn't connected yet.");
    }
    _client = new Anthropic();
  }
  return _client;
}

// Model choice lives in lib/ai-budget.ts. Kept for any imports of MODEL.
export const MODEL = AI_MODELS.default;

type CallOpts = {
  user: string;
  maxTokens?: number;
  effort?: Effort;
  // "premium" opts a single call into the expensive model. Default is cheap.
  tier?: ModelTier;
  // Label for the usage log, e.g. "script" or "ideas".
  feature?: string;
  // Turn off extended thinking for small, fast calls like angle ideas.
  noThinking?: boolean;
  // Streaming only: text already written, to pick up where an earlier stream stopped.
  partial?: string;
};

function logUsage(model: string, feature: string | undefined, usage: Anthropic.Usage | undefined) {
  if (!usage) return Promise.resolve();
  const costUsd = estimateCostUsd(model, {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens,
    cacheWriteTokens: usage.cache_creation_input_tokens,
  });
  return recordUsage({
    provider: "anthropic",
    model,
    feature,
    inputTokens:
      (usage.input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
    costUsd,
  });
}

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
    "You are the AI core of CreatorAI, a personal operating system for an independent content creator.",
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
    `Voice description: ${profile?.voice || "(not set, infer a balanced, conversational, expert tone)"}`,
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

// Wraps messages.create with our defaults (see lib/ai-budget.ts) and the
// cached system prompt. Checks the daily budget first and logs the cost after.
// Returns the first text block's content.
export async function complete(opts: CallOpts & {
  jsonSchema?: Record<string, unknown>;
}): Promise<string> {
  await assertWithinBudget();
  const system = await creatorSystemPrompt();
  const model = AI_MODELS[opts.tier ?? "default"];

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: opts.maxTokens ?? 8000,
    system,
    thinking: opts.noThinking ? { type: "disabled" } : { type: "adaptive" },
    output_config: { effort: opts.effort ?? DEFAULT_EFFORT },
    messages: [{ role: "user", content: opts.user }],
  };

  if (opts.jsonSchema) {
    params.output_config = {
      ...(params.output_config ?? {}),
      format: { type: "json_schema", schema: opts.jsonSchema },
    };
  }

  const response = await client().messages.create(params);
  await logUsage(model, opts.feature, response.usage);

  const text = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  return text?.text ?? "";
}

// Streaming version, used by the studio for live feedback. The budget check
// runs before the stream starts so the route can return a clean 429.
export async function streamCompletion(opts: CallOpts): Promise<ReadableStream<Uint8Array>> {
  await assertWithinBudget();
  const system = await creatorSystemPrompt();
  const model = AI_MODELS[opts.tier ?? "default"];
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      // Everything written so far, including an earlier partial draft.
      let written = opts.partial?.trimEnd() ?? "";
      let round = 0;
      try {
        while (true) {
          const messages = continuationMessages(opts.user, written);
          const continuing = messages.length > 1;
          let piece = "";
          let sentUpTo = 0;
          const stream = client().messages.stream({
            model,
            max_tokens: opts.maxTokens ?? 8000,
            system,
            // Thinking shares max_tokens with the answer, so long writing turns it off.
            thinking: opts.noThinking ? { type: "disabled" } : { type: "adaptive" },
            output_config: { effort: opts.effort ?? DEFAULT_EFFORT },
            messages,
          });

          stream.on("text", (delta) => {
            piece += delta;
            if (!continuing) {
              controller.enqueue(encoder.encode(delta));
              return;
            }
            // A continuation repeats the last few words first. Hold the opening
            // back until the overlap can be trimmed, then stream the rest.
            if (sentUpTo === 0 && piece.length < 120) return;
            const joined = joinContinuation(written, piece);
            const fresh = joined.slice(written.length + sentUpTo);
            if (fresh) {
              controller.enqueue(encoder.encode(fresh));
              sentUpTo += fresh.length;
            }
          });

          const final = await stream.finalMessage();
          await logUsage(model, opts.feature, final.usage);
          if (continuing) {
            const joined = joinContinuation(written, piece);
            const fresh = joined.slice(written.length + sentUpTo);
            if (fresh) controller.enqueue(encoder.encode(fresh));
            written = joined;
          } else {
            written = piece;
          }
          if (!shouldContinue(final.stop_reason, round)) {
            if (final.stop_reason === "max_tokens") {
              controller.enqueue(encoder.encode(`${ERROR_MARKER} The script is very long and was paused. Press Continue to finish it.`));
            } else {
              controller.enqueue(encoder.encode(DONE_MARKER));
            }
            break;
          }
          round += 1;
          await assertWithinBudget();
        }
        controller.close();
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        console.error("stream stopped", opts.feature, raw);
        const friendly =
          err instanceof BudgetExceededError || raw === "AI writing isn't connected yet."
            ? raw
            : "The writer stopped early. Press Continue to finish the script.";
        controller.enqueue(encoder.encode(`${ERROR_MARKER} ${friendly}`));
        controller.close();
      }
    },
  });
}
