// Character timings from ElevenLabs become ASS captions for one scene clip.
// Times are local to that clip, starting at zero, so they stay in sync after concat.

import { frameSize, type Aspect } from "@/lib/produce/types";
import { plain } from "@/lib/produce/text";

export type Alignment = {
  characters: string[];
  starts: number[];
  ends: number[];
};

export type CaptionCue = {
  text: string;
  start: number;
  end: number;
};

const MAX_CUE_CHARS = 42;
const MAX_CUE_WORDS = 6;

export function wordsFromAlignment(alignment: Alignment): CaptionCue[] {
  const words: CaptionCue[] = [];
  let text = "";
  let start = -1;
  let end = 0;
  const flush = () => {
    const clean = plain(text);
    if (clean && start >= 0) words.push({ text: clean, start, end: Math.max(end, start + 0.05) });
    text = "";
    start = -1;
  };
  for (let i = 0; i < alignment.characters.length; i++) {
    const ch = alignment.characters[i] ?? "";
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    if (start < 0) start = alignment.starts[i] ?? 0;
    text += ch;
    end = alignment.ends[i] ?? end;
  }
  flush();
  return words;
}

export function cuesFromAlignment(alignment: Alignment, audioDuration: number): CaptionCue[] {
  const words = wordsFromAlignment(alignment);
  const cues: CaptionCue[] = [];
  let bucket: CaptionCue[] = [];
  const flush = () => {
    if (!bucket.length) return;
    const text = bucket.map((word) => word.text).join(" ");
    const start = bucket[0].start;
    const end = bucket[bucket.length - 1].end;
    cues.push({ text, start, end: Math.max(end, start + 0.08) });
    bucket = [];
  };
  for (const word of words) {
    const next = bucket.length ? `${bucket.map((item) => item.text).join(" ")} ${word.text}` : word.text;
    const boundary = /[.!?]$/.test(bucket[bucket.length - 1]?.text ?? "");
    if (bucket.length && (boundary || next.length > MAX_CUE_CHARS || bucket.length >= MAX_CUE_WORDS)) flush();
    bucket.push(word);
  }
  flush();
  const limit = Math.max(audioDuration, 0.2);
  return cues.map((cue, index) => {
    const next = cues[index + 1]?.start ?? limit;
    const end = Math.min(Math.max(cue.end, cue.start + 0.08), next, limit);
    return { ...cue, start: Math.max(0, Math.min(cue.start, end - 0.05)), end };
  });
}

function assTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.min(99, Math.floor((safe - Math.floor(safe)) * 100));
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function assText(text: string): string {
  return plain(text)
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\N");
}

export function buildAss(cues: CaptionCue[], aspect: Aspect): string {
  const { width, height } = frameSize(aspect);
  const fontSize = aspect === "9:16" ? 64 : 52;
  const marginV = aspect === "9:16" ? 220 : 72;
  const events = cues
    .filter((cue) => cue.text && cue.end > cue.start)
    .map(
      (cue) =>
        `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Caption,,0,0,0,,${assText(cue.text)}`,
    )
    .join("\n");
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,DejaVu Sans,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,4,0,2,80,80,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;
}
