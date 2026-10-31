// Checks a produce request before any voice or encode work starts.

import { cardsFromScript, estimateDuration } from "@/lib/produce/cards";
import { plain } from "@/lib/produce/text";
import { DEFAULT_VOICE, type Aspect, type ChannelPalette, type ProduceInput, type SceneCard, type VoiceSettings } from "@/lib/produce/types";

const MAX_SCENES = 200;
const MAX_TOTAL_CHARS = 24000;

export type ProduceBody = ProduceInput & { contentId: number | null };

function num(value: unknown, fallback: number, min: number, max: number, label: string): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return n;
}

function voiceFrom(raw: unknown): VoiceSettings {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
  if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId)) {
    throw new Error("voice.voiceId must be a locked ElevenLabs voice ID.");
  }
  const boost = body.use_speaker_boost ?? body.useSpeakerBoost;
  if (boost !== undefined && typeof boost !== "boolean") {
    throw new Error("voice.use_speaker_boost must be true or false.");
  }
  return {
    voiceId,
    stability: num(body.stability, DEFAULT_VOICE.stability, 0, 1, "voice.stability"),
    similarity_boost: num(
      body.similarity_boost ?? body.similarityBoost,
      DEFAULT_VOICE.similarity_boost,
      0,
      1,
      "voice.similarity_boost",
    ),
    style: num(body.style, DEFAULT_VOICE.style, 0, 1, "voice.style"),
    use_speaker_boost: typeof boost === "boolean" ? boost : DEFAULT_VOICE.use_speaker_boost,
    speed: num(body.speed, DEFAULT_VOICE.speed, 0.7, 1.2, "voice.speed"),
  };
}

function sceneFrom(raw: unknown, index: number): SceneCard {
  if (!raw || typeof raw !== "object") throw new Error(`Scene ${index + 1} is missing.`);
  const body = raw as Record<string, unknown>;
  const title = plain(typeof body.title === "string" ? body.title : "");
  const narration = plain(typeof body.narration === "string" ? body.narration : "");
  const visual = plain(typeof body.visual === "string" ? body.visual : "");
  if (!narration) throw new Error(`Scene ${index + 1} needs narration.`);
  if (narration.length > 1800) throw new Error(`Scene ${index + 1} narration is too long.`);
  if (title.length > 120) throw new Error(`Scene ${index + 1} title is too long.`);
  if (visual.length > 6000) throw new Error(`Scene ${index + 1} visual is too long.`);
  const duration = num(body.duration, estimateDuration(narration), 0, 180, `Scene ${index + 1} duration`);
  return {
    title: title || narration.split(/\s+/).slice(0, 6).join(" "),
    narration,
    visual: visual || `big-text: ${title || "Scene"}`,
    duration,
  };
}

function aspectFrom(body: Record<string, unknown>): Aspect {
  const format = typeof body.format === "string" ? body.format : "";
  const aspect = typeof body.aspect === "string" ? body.aspect : "";
  if (aspect === "9:16" || aspect === "16:9") return aspect;
  if (aspect === "short" || format === "short" || format === "9:16") return "9:16";
  if (aspect === "long" || format === "long" || format === "16:9") return "16:9";
  if (!aspect && !format) return "9:16";
  throw new Error("aspect must be 9:16 for Shorts or 16:9 for long form.");
}

export function parseProduceBody(raw: unknown): ProduceBody {
  if (!raw || typeof raw !== "object") throw new Error("Send a JSON body.");
  const body = raw as Record<string, unknown>;
  const title = plain(typeof body.title === "string" ? body.title : "");
  if (!title) throw new Error("title is required.");
  if (title.length > 140) throw new Error("title is too long.");
  const aspect = aspectFrom(body);
  const voice = voiceFrom(body.voice);
  let scenes: SceneCard[];
  if (Array.isArray(body.scenes) && body.scenes.length) {
    if (body.scenes.length > MAX_SCENES) throw new Error(`One film holds up to ${MAX_SCENES} scenes.`);
    scenes = body.scenes.map(sceneFrom);
  } else if (typeof body.script === "string" && body.script.trim()) {
    scenes = cardsFromScript(body.script, title).slice(0, MAX_SCENES);
    if (!scenes.length) throw new Error("The script did not contain any spoken lines.");
  } else {
    throw new Error("Send scenes or a script.");
  }
  const total = scenes.reduce((sum, scene) => sum + scene.narration.length, 0);
  if (total > MAX_TOTAL_CHARS) {
    throw new Error("That script is too long for one render. Split it into two films.");
  }
  const channel = plain(typeof body.channel === "string" ? body.channel : "").slice(0, 28);
  const palette = paletteFrom(body.palette);
  let contentId: number | null = null;
  if (body.contentId !== undefined && body.contentId !== null && body.contentId !== "") {
    const id = Number(body.contentId);
    if (!Number.isInteger(id) || id < 1) throw new Error("contentId must be a planner item id.");
    contentId = id;
  }
  return { title, aspect, voice, scenes, contentId, ...(channel ? { channel } : {}), ...(palette ? { palette } : {}) };
}

function paletteFrom(raw: unknown): ChannelPalette | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const body = raw as Record<string, unknown>;
  const hex = (key: string) => {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) throw new Error(`palette.${key} must be a 6 digit hex color.`);
    return value;
  };
  return {
    navy: hex("navy"),
    bone: hex("bone"),
    amber: hex("amber"),
    teal: hex("teal"),
    slate: hex("slate"),
  };
}
