// Browser side of a long voiceover: checks the daily voice limit up front, sends the scenes in
// requests of whole scenes (two at a time), retries a failed request once, and joins the audio into
// one track with every scene's measured start and end. All or nothing: if any scene cannot be
// voiced, the result says which scenes and why, and no partial track is returned.

import { layoutParts, voiceBatches, voiceLimitNote, type Span } from "./voice-plan";

export type VoiceTrack =
  | { ok: true; buffer: AudioBuffer; spans: Span[]; total: number; requests: number }
  | { ok: false; error: string; code?: string };

type Answer = { ok?: boolean; error?: string; code?: string; parts?: string[]; audioBase64?: string; counts?: number[] };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeMp3(context: BaseAudioContext, base64: string): Promise<AudioBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return context.decodeAudioData(bytes.buffer.slice(0));
}

async function ask(segments: string[], voiceId: string): Promise<{ answer: Answer; status: number; retryAfter: number }> {
  try {
    const res = await fetch("/api/ai/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments, voiceId }),
    });
    const answer = (await res.json().catch(() => ({}))) as Answer;
    return { answer, status: res.status, retryAfter: Number(res.headers.get("retry-after")) || 0 };
  } catch {
    return { answer: { ok: false, error: "Voice didn't answer" }, status: 0, retryAfter: 0 };
  }
}

/** How many voice requests a script needs. */
export function voiceRequestsFor(segments: string[]): number {
  return voiceBatches(segments).length;
}

export async function voiceTrack(opts: {
  segments: string[];
  voiceId: string;
  context: BaseAudioContext;
  onProgress?: (done: number, total: number) => void;
}): Promise<VoiceTrack> {
  const { segments, voiceId, context } = opts;
  const batches = voiceBatches(segments);
  if (!batches.length) return { ok: false, error: "Nothing to say" };

  // Say up front when today's limit cannot cover the whole script, instead of stopping part way.
  try {
    const status = (await fetch("/api/ai/narrate").then((res) => res.json())) as { left?: number | null; limit?: number };
    const note = voiceLimitNote(batches.length, typeof status.left === "number" ? status.left : null, status.limit ?? 0);
    if (note) return { ok: false, error: note, code: "budget_exceeded" };
  } catch {
    /* the requests below still enforce the limit */
  }

  const results: { buffers: AudioBuffer[]; counts: number[] }[] = new Array(batches.length);
  type Failure = { error: string; code?: string; batch: number };
  // Set from inside the workers, so the type is spelled out to keep it from narrowing to null.
  let failure = null as Failure | null;
  let next = 0;
  let done = 0;
  opts.onProgress?.(0, batches.length);

  const runBatch = async (index: number) => {
    const texts = batches[index].map((i) => segments[i]);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (failure) return;
      const { answer, status, retryAfter } = await ask(texts, voiceId);
      const parts = answer.ok ? (answer.parts?.length ? answer.parts : answer.audioBase64 ? [answer.audioBase64] : []) : [];
      const counts = answer.counts ?? [];
      if (parts.length && counts.length === texts.length && counts.reduce((a, b) => a + b, 0) === parts.length) {
        try {
          const buffers: AudioBuffer[] = [];
          for (const part of parts) buffers.push(await decodeMp3(context, part));
          results[index] = { buffers, counts };
          return;
        } catch {
          /* unreadable audio, try once more */
        }
      }
      // The daily limit and an over long request will not change on a retry.
      if (answer.code === "budget_exceeded" || answer.code === "too_long") {
        failure = { error: answer.error || "Voice limit reached", code: answer.code, batch: index };
        return;
      }
      if (attempt === 0) await wait(status === 429 ? Math.min(10, Math.max(1, retryAfter)) * 1000 : 1500);
      else failure = { error: answer.error || "Voice didn't answer", code: answer.code, batch: index };
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(2, batches.length) }, async () => {
      while (!failure && next < batches.length) {
        const index = next++;
        await runBatch(index);
        if (results[index]) {
          done += 1;
          opts.onProgress?.(done, batches.length);
        }
      }
    }),
  );

  if (failure) {
    const lost = batches[failure.batch];
    const from = lost[0] + 1;
    const to = lost[lost.length - 1] + 1;
    const where = from === to ? `scene ${from}` : `scenes ${from} to ${to}`;
    const reason = failure.error.replace(/\.?$/, ".");
    return {
      ok: false,
      code: failure.code,
      error: `The voice could not read ${where} of ${segments.length}, so the voice is not added yet. ${reason}`,
    };
  }

  const buffers = results.flatMap((result) => result.buffers);
  const counts = results.flatMap((result) => result.counts);
  const layout = layoutParts(
    buffers.map((buffer) => buffer.duration),
    counts,
  );
  const rate = buffers[0]?.sampleRate ?? 24000;
  const channels = buffers[0]?.numberOfChannels ?? 1;
  const joined = context.createBuffer(channels, Math.max(1, Math.ceil(layout.total * rate) + 1), rate);
  buffers.forEach((buffer, index) => {
    const offset = Math.round(layout.partStarts[index] * rate);
    for (let channel = 0; channel < Math.min(channels, buffer.numberOfChannels); channel += 1) {
      const data = buffer.getChannelData(channel);
      const room = joined.length - offset;
      joined.getChannelData(channel).set(room >= data.length ? data : data.subarray(0, Math.max(0, room)), offset);
    }
  });
  return { ok: true, buffer: joined, spans: layout.spans, total: layout.total, requests: batches.length };
}

/** A WAV file of an audio buffer, for an audio element that a recorder can capture. */
export function wavBlob(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const frames = buffer.length;
  const bytes = 44 + frames * channels * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const text = (at: number, value: string) => [...value].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, bytes - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * channels * 2, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let at = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(at, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      at += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}
