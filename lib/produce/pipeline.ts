// Full faceless film: voice with timings, scene art, per scene clips, concat, Blob.
// The work runs on a Fluid Compute function (maxDuration 800) via ffmpeg-static.
// A sandbox microVM was not used. These steps are our own code, not untrusted
// input, and still image clips encode fast enough that an 8 to 12 minute film
// stays inside the function. Secrets stay in this process.

import { mkdtemp, rm, stat } from "fs/promises";
import { createReadStream } from "fs";
import os from "os";
import path from "path";
import { put } from "@vercel/blob";
import { getDeadline } from "@vercel/functions";
import { cuesFromAlignment, wordsFromAlignment, type CaptionCue } from "@/lib/produce/captions";
import { beatsFromVisual, isDescriptive, stagesForScene } from "@/lib/produce/describe";
import { drawBeatPng, drawBeatSvg } from "@/lib/produce/draw";
import { ElevenLabsAuthError, mapPool, voiceScene } from "@/lib/produce/elevenlabs";
import { encodeFilm, mediaDuration, sliceAudio } from "@/lib/produce/ffmpeg";
import { channelName, failContent, finishContent, patchJob, readJob } from "@/lib/produce/jobs";
import { stockPlate } from "@/lib/produce/stock";
import { parseVisual, renderScenePng, sceneSvg } from "@/lib/produce/visuals";
import { SOVEREIGN_PALETTE, type ProduceInput } from "@/lib/produce/types";
import { writeFile } from "fs/promises";

function assertTime(): void {
  const deadline = getDeadline();
  if (!deadline) return;
  if (deadline.getTime() - Date.now() < 25_000) {
    throw new Error(
      "This render needs more time than the function limit allows. Split the film, or run it on a plan that allows a longer maxDuration.",
    );
  }
}

function inputOf(raw: string): ProduceInput {
  const parsed = JSON.parse(raw) as ProduceInput;
  if (!parsed?.scenes?.length || !parsed.voice?.voiceId) throw new Error("This job is missing its scene cards.");
  return parsed;
}

export async function runProduceJob(jobId: string): Promise<void> {
  let row: Awaited<ReturnType<typeof readJob>> = null;
  let dir = "";
  try {
    row = await readJob(jobId);
    if (!row) return;
    dir = await mkdtemp(path.join(os.tmpdir(), "produce-"));
    const input = inputOf(row.input);
    const total = input.scenes.length;
    assertTime();
    await patchJob(jobId, { status: "voicing", progress: 4, message: `Voicing scene 1 of ${total}` });

    let voiced = 0;
    const audio = await mapPool(input.scenes, 3, async (scene, index) => {
      assertTime();
      const file = path.join(dir, `audio-${String(index + 1).padStart(3, "0")}.mp3`);
      const alignment = await voiceScene(scene.narration, input.voice, file);
      voiced += 1;
      const progress = 4 + Math.round((voiced / total) * 36);
      await patchJob(jobId, {
        status: "voicing",
        progress,
        message: `Voicing scene ${Math.min(total, voiced)} of ${total}`,
      });
      return { file, alignment, index };
    });

    assertTime();
    await patchJob(jobId, { status: "drawing", progress: 42, message: "Drawing scene 1" });
    const channel = input.channel || (await channelName());
    const palette = input.palette || SOVEREIGN_PALETTE;
    const drawn: { png: string; audio: string; cues: CaptionCue[]; planned: number }[] = [];
    const generic: string[] = [];
    for (let index = 0; index < input.scenes.length; index++) {
      const scene = input.scenes[index];
      const spoken = audio.find((item) => item.index === index);
      if (!spoken) throw new Error(`Scene ${index + 1} has no audio.`);
      const duration = await mediaDuration(spoken.file, dir);
      const described = Boolean(input.palette) || isDescriptive(scene.visual);
      if (!described) {
        const parsed = parseVisual(scene.visual, scene.title);
        const plate = parsed.kind === "stock" ? await stockPlate(parsed.query) : null;
        const svg = sceneSvg(scene, input.aspect, index, total, channel, plate);
        const png = path.join(dir, `visual-${String(index + 1).padStart(3, "0")}.png`);
        await writeFile(png, renderScenePng(svg, input.aspect));
        drawn.push({
          png,
          audio: spoken.file,
          cues: cuesFromAlignment(spoken.alignment, duration),
          planned: scene.duration,
        });
      } else {
        const beats = beatsFromVisual(scene.visual, scene.title);
        const words = wordsFromAlignment(spoken.alignment);
        const stages = stagesForScene(beats, words, duration);
        const fullCues = cuesFromAlignment(spoken.alignment, duration);
        for (let beatIndex = 0; beatIndex < stages.length; beatIndex++) {
          const stage = stages[beatIndex];
          const beat = stage.beat;
          if (beat.kind === "generic") generic.push(`${scene.title}: ${beat.body.slice(0, 80)}`);
          const length = Math.max(0.45, stage.end - stage.start);
          const slice = path.join(dir, `audio-${String(index + 1).padStart(2, "0")}-${beatIndex}.wav`);
          const png = path.join(dir, `visual-${String(index + 1).padStart(2, "0")}-${beatIndex}.png`);
          await sliceAudio(spoken.file, slice, stage.start, length, dir);
          const svg = drawBeatSvg({
            beat,
            aspect: input.aspect,
            palette,
            channel,
            sceneIndex: index,
            sceneTotal: total,
          });
          await writeFile(png, drawBeatPng(svg, input.aspect));
          const cues = fullCues
            .filter((cue) => cue.end > stage.start && cue.start < stage.end)
            .map((cue) => ({
              text: cue.text,
              start: Math.max(0, cue.start - stage.start),
              end: Math.min(length, cue.end - stage.start),
            }))
            .filter((cue) => cue.end - cue.start > 0.05);
          drawn.push({ png, audio: slice, cues, planned: 0 });
        }
      }
      await patchJob(jobId, {
        status: "drawing",
        progress: 42 + Math.round(((index + 1) / total) * 20),
        message: `Drawing scene ${index + 1} of ${total}`,
      });
    }
    if (generic.length) console.info("produce generic visuals", generic.join(" || "));

    assertTime();
    await patchJob(jobId, { status: "encoding", progress: 64, message: `Encoding scene 1 of ${total}` });
    const film = await encodeFilm({
      dir,
      aspect: input.aspect,
      scenes: drawn,
      onScene: async (done, count) => {
        await patchJob(jobId, {
          status: "encoding",
          progress: 64 + Math.round((done / count) * 24),
          message: done === count ? "Joining clips" : `Encoding scene ${done} of ${count}`,
        });
      },
    });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN is not set. Connect a Vercel Blob store to this project for Production and Preview.",
      );
    }
    await patchJob(jobId, { status: "uploading", progress: 92, message: "Saving the file" });
    const size = (await stat(film)).size;
    const blob = await put(`produce/${jobId}.mp4`, createReadStream(film), {
      access: "public",
      contentType: "video/mp4",
      multipart: size > 4 * 1024 * 1024,
    });
    if (row.contentId) await finishContent(row.contentId, jobId, blob.url);
    await patchJob(jobId, {
      status: "completed",
      progress: 100,
      message: generic.length ? `Ready. Generic cards: ${generic.map((item) => item.split(":")[0]).join(", ")}` : "Ready",
      videoUrl: blob.url,
      error: "",
      blocker: "",
    });
    console.info("produce completed", jobId);
  } catch (error) {
    const blocker = error instanceof ElevenLabsAuthError ? error.blocker : "";
    const message = error instanceof Error ? error.message : "Render failed.";
    console.error("produce failed", jobId, blocker || message);
    await patchJob(jobId, {
      status: "failed",
      message,
      error: message,
      blocker,
    }).catch(() => undefined);
    const latest = await readJob(jobId).catch(() => null);
    await failContent(latest?.contentId ?? row?.contentId ?? null, jobId);
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
