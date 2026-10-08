import { prisma } from "./db";

// Central AI model and spending settings.
//
// Default: Sonnet 4.6 at medium effort. Roughly 40% cheaper per token than
// Opus 4.7 and noticeably faster. A feature can opt into the expensive model
// by passing tier: "premium" to complete() or streamCompletion().
export const AI_MODELS = {
  default: process.env.AI_MODEL_DEFAULT || "claude-sonnet-4-6",
  premium: process.env.AI_MODEL_PREMIUM || "claude-opus-4-7",
  // Small, quick jobs like turning script lines into photo search terms.
  fast: process.env.AI_MODEL_FAST || "claude-haiku-4-5",
} as const;

// Haiku 4.5 and older models reject output_config.effort with a 400.
export function supportsEffort(model: string): boolean {
  return !/haiku-4|haiku-3|sonnet-4-5|sonnet-4-0|opus-4-1|opus-4-0|claude-3/.test(model);
}

export type ModelTier = keyof typeof AI_MODELS;
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export const DEFAULT_EFFORT: Effort = "medium";

// USD per million tokens. Published list prices, used only for the estimate.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "grok-4.5": { input: 3, output: 15 },
};
const FALLBACK_PRICE = { input: 5, output: 25 }; // assume the worst for unknown models

export function estimateCostUsd(
  model: string,
  usage: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    cacheReadTokens?: number | null;
    cacheWriteTokens?: number | null;
  },
): number {
  const price = PRICES[model] ?? FALLBACK_PRICE;
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheWrite = usage.cacheWriteTokens ?? 0;
  return (
    (input * price.input +
      output * price.output +
      cacheRead * price.input * 0.1 +
      cacheWrite * price.input * 1.25) /
    1_000_000
  );
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function dailyBudgetUsd(): number {
  return numberEnv("AI_DAILY_BUDGET_USD", 5);
}

export function dailyVoiceLimit(): number {
  return numberEnv("AI_DAILY_VOICE_LIMIT", 100);
}

// The cap resets at midnight UTC (6 or 7 PM US Central).
function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export class BudgetExceededError extends Error {
  status = 429;
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export async function spentTodayUsd(): Promise<number> {
  const agg = await prisma.aiUsage.aggregate({
    _sum: { costUsd: true },
    where: { createdAt: { gte: startOfTodayUtc() } },
  });
  return agg._sum.costUsd ?? 0;
}

// Throws BudgetExceededError when today's estimated AI spend has reached the cap.
export async function assertWithinBudget(): Promise<void> {
  const budget = dailyBudgetUsd();
  const spent = await spentTodayUsd();
  if (spent >= budget) {
    throw new BudgetExceededError(
      `You've reached today's AI spending limit ($${budget.toFixed(2)}). ` +
        "It resets at midnight UTC. You can still edit and save your work in the meantime.",
    );
  }
}

export async function voicesUsedToday(): Promise<number> {
  return prisma.aiUsage.count({
    where: { feature: "voice", createdAt: { gte: startOfTodayUtc() } },
  });
}

// Throws BudgetExceededError when today's voice request count has reached the cap.
export async function assertWithinVoiceLimit(): Promise<void> {
  const limit = dailyVoiceLimit();
  const used = await voicesUsedToday();
  if (used >= limit) {
    throw new BudgetExceededError(
      `You've used today's ${limit} voiceovers. The limit resets at midnight UTC.`,
    );
  }
}

export async function recordUsage(entry: {
  provider: string;
  model?: string;
  feature?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}): Promise<void> {
  try {
    await prisma.aiUsage.create({
      data: {
        provider: entry.provider,
        model: entry.model ?? "",
        feature: entry.feature ?? "",
        inputTokens: Math.max(0, Math.round(entry.inputTokens ?? 0)),
        outputTokens: Math.max(0, Math.round(entry.outputTokens ?? 0)),
        costUsd: Math.max(0, entry.costUsd ?? 0),
      },
    });
  } catch (e) {
    // Never fail the user's request because the usage log could not be written.
    console.error("[ai-budget] failed to record usage", e);
  }
}

export function budgetErrorResponse(e: BudgetExceededError): Response {
  return new Response(JSON.stringify({ error: e.message, code: "budget_exceeded" }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
}
