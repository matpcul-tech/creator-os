import { LAYOUTS, STILLS, VOICE_LIMIT, VOICES, type Layout, type StillId } from "@/lib/cut/types";

const voiceIds = new Set(VOICES.map((voice) => voice.id));
const layouts = new Set(LAYOUTS.map((layout) => layout.id));
const stills = new Set(STILLS.map((still) => still.id));

type VoiceStamp = { start: number; end: number };

export type VoiceResult =
  | { ok: false; error: string }
  | { ok: true; audioBase64: string; duration: number; chars: string[]; times: VoiceStamp[] };

function stamps(times: unknown[] | undefined): VoiceStamp[] {
  if (!times) return [];
  return times.map((value) => {
    if (Array.isArray(value) && value.length >= 2) {
      return { start: Number(value[0]) || 0, end: Number(value[1]) || 0 };
    }
    if (value && typeof value === "object" && "start" in value && "end" in value) {
      const item = value as { start: unknown; end: unknown };
      return { start: Number(item.start) || 0, end: Number(item.end) || 0 };
    }
    return { start: 0, end: 0 };
  });
}

export function voiceConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY);
}

export async function scoreNarration(text: string, voiceId: string): Promise<VoiceResult> {
  const clean = text.trim();
  const voice = voiceId.trim().toLowerCase();
  if (!clean) return { ok: false, error: "Nothing to say" };
  if (clean.length > VOICE_LIMIT) return { ok: false, error: "This cut is too long to voice in one pass" };
  if (!voiceIds.has(voice)) return { ok: false, error: "Unknown voice" };

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "Add XAI_API_KEY to voice this cut" };

  let response: Response;
  try {
    response = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: clean,
        voice_id: voice,
        language: "en",
        with_timestamps: true,
        text_normalization: true,
        output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
      }),
    });
  } catch {
    return { ok: false, error: "Voice didn't answer" };
  }

  if (!response.ok) return { ok: false, error: "Voice didn't answer" };

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await response.json()) as {
      audio?: string;
      duration?: number;
      audio_timestamps?: { graph_chars?: string[]; graph_times?: unknown[] };
    };
    if (!json.audio) return { ok: false, error: "Voice came back empty" };
    return {
      ok: true,
      audioBase64: json.audio,
      duration: Number(json.duration) || 0,
      chars: json.audio_timestamps?.graph_chars ?? [],
      times: stamps(json.audio_timestamps?.graph_times),
    };
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  const chunk = 4096;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return { ok: true, audioBase64: btoa(binary), duration: 0, chars: [], times: [] };
}

export async function sharpenCards(narrations: string[]) {
  if (narrations.length < 1 || narrations.length > 8) {
    return { ok: false as const, error: "Need between 1 and 8 scenes" };
  }
  const clean = narrations.map((item) => item.trim().slice(0, 500));
  if (clean.some((item) => !item)) return { ok: false as const, error: "Every scene needs words" };

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false as const, error: "Add XAI_API_KEY to sharpen lines" };

  const numbered = clean.map((line, index) => `${index + 1}. ${line}`).join("\n");
  let response: Response;
  try {
    response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              'You direct on-screen type for a short film. Return JSON only: {"cards":[{"onscreen":"","layout":"hook|statement|stat|list|close","still":"desk|city|mic|path|cafe|paper|crowd|phone"}]}. One card per narration, same order. onscreen is at most 8 words, or a number plus a short line, or up to 3 short lines separated by newline. Do not rewrite the spoken narration. First card layout is hook. Last card layout is close. No markdown.',
          },
          { role: "user", content: numbered },
        ],
      }),
    });
  } catch {
    return { ok: false as const, error: "Sharpen didn't answer" };
  }

  if (!response.ok) return { ok: false as const, error: "Sharpen didn't answer" };
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content ?? "";
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < start) return { ok: false as const, error: "Sharpen came back unreadable" };

  try {
    const parsed = JSON.parse(content.slice(start, end + 1)) as {
      cards?: { onscreen?: string; layout?: string; still?: string }[];
    };
    const cards = parsed.cards ?? [];
    if (cards.length !== clean.length) return { ok: false as const, error: "Sharpen came back short" };
    const shaped = cards.map((card) => ({
      onscreen: (card.onscreen ?? "").trim().slice(0, 160),
      layout: (layouts.has(card.layout as Layout) ? card.layout : "statement") as Layout,
      still: (stills.has(card.still as StillId) ? card.still : "desk") as StillId,
    }));
    if (shaped.some((card) => !card.onscreen)) return { ok: false as const, error: "Sharpen came back empty" };
    shaped[0].layout = "hook";
    shaped[shaped.length - 1].layout = "close";
    return { ok: true as const, cards: shaped };
  } catch {
    return { ok: false as const, error: "Sharpen came back unreadable" };
  }
}
