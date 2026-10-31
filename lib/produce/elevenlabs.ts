// ElevenLabs text to speech with character timings, one call per scene.
// A 401 is a blocker: the caller must not switch providers or drop captions.

import { writeFile } from "fs/promises";
import type { Alignment } from "@/lib/produce/captions";
import type { VoiceSettings } from "@/lib/produce/types";

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL = "eleven_multilingual_v2";

export class ElevenLabsAuthError extends Error {
  readonly blocker = "elevenlabs_auth" as const;
  constructor() {
    super(
      "ElevenLabs rejected the API key (401). Video production is blocked until ELEVENLABS_API_KEY is valid for this deployment.",
    );
    this.name = "ElevenLabsAuthError";
  }
}

type RawAlignment = {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function key(): string {
  const value = (process.env.ELEVENLABS_API_KEY || "").trim();
  if (!value) throw new Error("ELEVENLABS_API_KEY is not set on this deployment.");
  return value;
}

function readAlignment(body: Record<string, unknown>): Alignment {
  const candidates = [body.normalized_alignment, body.alignment];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const raw = candidate as RawAlignment;
    const characters = raw.characters;
    const starts = raw.character_start_times_seconds;
    const ends = raw.character_end_times_seconds;
    if (!characters?.length || !starts || !ends) continue;
    if (starts.length < characters.length || ends.length < characters.length) continue;
    return { characters, starts, ends };
  }
  throw new Error("ElevenLabs did not return character timings, so captions cannot be aligned.");
}

function safeDetail(text: string): string {
  return text.replace(/[A-Za-z0-9_\-]{28,}/g, "[redacted]").slice(0, 220);
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: { message?: string } | string };
    if (typeof body.detail === "string") return safeDetail(body.detail);
    if (body.detail && typeof body.detail.message === "string") return safeDetail(body.detail.message);
  } catch {
    // The body was not JSON. The status code is enough.
  }
  return "";
}

export async function voiceScene(text: string, voice: VoiceSettings, file: string): Promise<Alignment> {
  const apiKey = key();
  let lastError = "ElevenLabs voice request failed.";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(voice.voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        voice_settings: {
          stability: voice.stability,
          similarity_boost: voice.similarity_boost,
          style: voice.style,
          use_speaker_boost: voice.use_speaker_boost,
          speed: voice.speed,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (res.status === 401) throw new ElevenLabsAuthError();
    if (res.status === 429 || res.status >= 500) {
      const waitSec = Number(res.headers.get("retry-after")) || 2 * (attempt + 1);
      lastError = `ElevenLabs voice request failed (${res.status}).`;
      if (attempt < 3) {
        await sleep(Math.min(20, Math.max(1, waitSec)) * 1000);
        continue;
      }
      throw new Error(lastError);
    }
    if (!res.ok) {
      const detail = await errorDetail(res);
      throw new Error(`ElevenLabs voice request failed (${res.status}). ${detail}`.trim());
    }
    const body = (await res.json()) as Record<string, unknown>;
    const audio = body.audio_base64;
    if (typeof audio !== "string" || audio.length < 16) {
      throw new Error("ElevenLabs did not return audio for this scene.");
    }
    await writeFile(file, Buffer.from(audio, "base64"));
    return readAlignment(body);
  }
  throw new Error(lastError);
}

export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}
