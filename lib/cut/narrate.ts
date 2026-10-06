import { LAYOUTS, STILLS, VOICES, type Layout, type StillId } from "@/lib/cut/types";

const voiceIds = new Set(VOICES.map((voice) => voice.id));
const layouts = new Set(LAYOUTS.map((layout) => layout.id));
const stills = new Set(STILLS.map((still) => still.id));

type VoiceStamp = { start: number; end: number };

export type VoiceResult =
  | { ok: false; error: string }
  | { ok: true; audioBase64: string; parts?: string[]; duration: number; chars: string[]; times: VoiceStamp[] };

export function voiceConfigured(): boolean {
  return true;
}

function pieces(text: string, max = 180): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?]?/g) ?? [text];
  const out: string[] = [];
  let buf = "";
  for (const raw of sentences) {
    const piece = raw.trim();
    if (!piece) continue;
    if (piece.length > max) {
      if (buf) out.push(buf);
      buf = "";
      const words = piece.split(/\s+/);
      let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (next.length > max && line) {
          out.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) out.push(line);
      continue;
    }
    const next = buf ? `${buf} ${piece}` : piece;
    if (next.length > max && buf) {
      out.push(buf);
      buf = piece;
    } else {
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out;
}

async function googlePart(text: string, voiceId: string): Promise<string> {
  const tongue: Record<string, string> = {
    ara: "en-GB",
    eve: "en-AU",
    leo: "en-IN",
    sal: "en-GB",
    lumen: "en-AU",
  };
  const tl = tongue[voiceId] ?? "en";
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=${tl}&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error("Voice didn't answer");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 200) throw new Error("Voice came back empty");
  return bytes.toString("base64");
}

async function googleNarration(text: string, voiceId: string): Promise<VoiceResult> {
  try {
    const parts = [];
    for (const piece of pieces(text)) parts.push(await googlePart(piece, voiceId));
    if (!parts.length) return { ok: false, error: "Nothing to say" };
    return { ok: true, audioBase64: parts[0], parts, duration: 0, chars: [], times: [] };
  } catch {
    return { ok: false, error: "Voice didn't answer" };
  }
}

export async function scoreNarration(text: string, voiceId: string): Promise<VoiceResult> {
  const clean = text.trim();
  const voice = voiceId.trim().toLowerCase();
  if (!clean) return { ok: false, error: "Nothing to say" };
  if (!voiceIds.has(voice)) return { ok: false, error: "Unknown voice" };

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return googleNarration(clean, voice);

  const voiced = await xaiNarration(apiKey, clean, voice);
  if (voiced) return voiced;
  return googleNarration(clean, voice);
}

async function xaiNarration(apiKey: string, text: string, voice: string): Promise<VoiceResult | null> {
  try {
    const parts: string[] = [];
    for (const piece of pieces(text, 1200)) {
      const audio = await xaiPart(apiKey, piece, voice);
      if (!audio) return null;
      parts.push(audio);
    }
    if (!parts.length) return null;
    return { ok: true, audioBase64: parts[0], parts, duration: 0, chars: [], times: [] };
  } catch {
    return null;
  }
}

async function xaiPart(apiKey: string, text: string, voice: string): Promise<string | null> {
  const response = await fetch("https://api.x.ai/v1/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: voice,
      language: "en",
      with_timestamps: true,
      text_normalization: true,
      output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
    }),
  });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await response.json()) as { audio?: string };
    return json.audio || null;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) return null;
  let binary = "";
  const chunk = 4096;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
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
