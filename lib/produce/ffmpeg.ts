// Each scene becomes its own clip (still, speech, burned in ASS captions).
// The clips are then joined with stream copy. Still images encode much faster
// than realtime, which is what makes an 8 to 12 minute film fit a function run.
// ffmpeg-static is used on Vercel. A local ffmpeg binary is the fallback.

import { spawn } from "child_process";
import { copyFile, mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { buildAss, type CaptionCue } from "@/lib/produce/captions";
import { fontFiles } from "@/lib/produce/visuals";
import { frameSize, type Aspect } from "@/lib/produce/types";

export function ffmpegBin(): string {
  if (ffmpegStatic) return ffmpegStatic;
  return "ffmpeg";
}

function run(bin: string, args: string[], cwd: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    const chunks: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      let size = 0;
      for (const part of chunks) size += part.length;
      if (size > 240_000) chunks.splice(0, chunks.length - 8);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stderr: Buffer.concat(chunks).toString("utf8").slice(-2500) });
    });
  });
}

export async function sliceAudio(src: string, dest: string, start: number, length: number, cwd: string): Promise<void> {
  const result = await run(
    ffmpegBin(),
    ["-y", "-i", src, "-ss", Math.max(0, start).toFixed(3), "-t", Math.max(0.35, length).toFixed(3), "-c:a", "pcm_s16le", dest],
    cwd,
  );
  if (result.code !== 0) throw new Error(`Could not split scene audio. ${result.stderr.slice(-300)}`.trim());
}

export async function mediaDuration(file: string, cwd: string): Promise<number> {
  const { stderr } = await run(ffmpegBin(), ["-hide_banner", "-i", file, "-f", "null", "-"], cwd);
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error("Could not read the audio length for a scene.");
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function seconds(value: number): string {
  return Math.max(0.35, value).toFixed(3);
}

async function ensureFonts(dir: string): Promise<void> {
  const fonts = fontFiles();
  const dest = path.join(dir, "fonts");
  await mkdir(dest, { recursive: true });
  await copyFile(fonts.regular, path.join(dest, "Inter-Regular.ttf"));
  await copyFile(fonts.bold, path.join(dest, "Inter-Bold.ttf"));
  await copyFile(fonts.black, path.join(dest, "Inter-Black.ttf"));
  await copyFile(fonts.data, path.join(dest, "IBMPlexSans-Regular.otf"));
  await copyFile(fonts.dataBold, path.join(dest, "IBMPlexSans-Bold.otf"));
}

async function joinClips(dir: string, clips: { name: string; length: number }[]): Promise<void> {
  const bin = ffmpegBin();
  if (clips.length === 1) {
    const result = await run(bin, ["-y", "-i", clips[0].name, "-c", "copy", "-movflags", "+faststart", "film.mp4"], dir);
    if (result.code !== 0) throw new Error(`Saving the film failed. ${result.stderr.slice(-400)}`.trim());
    return;
  }
  const shortest = Math.min(...clips.map((clip) => clip.length));
  const fade = Math.min(0.28, Math.max(0.12, shortest * 0.22));
  const args = ["-y"];
  for (const clip of clips) args.push("-i", clip.name);
  const parts: string[] = [];
  let video = "[0:v]";
  let audio = "[0:a]";
  let cursor = clips[0].length;
  for (let index = 1; index < clips.length; index++) {
    const videoOut = index === clips.length - 1 ? "[v]" : `[vx${index}]`;
    const audioOut = index === clips.length - 1 ? "[a]" : `[ax${index}]`;
    const offset = Math.max(0, cursor - fade);
    parts.push(
      `${video}[${index}:v]xfade=transition=fade:duration=${fade.toFixed(3)}:offset=${offset.toFixed(3)}${videoOut}`,
    );
    parts.push(`${audio}[${index}:a]acrossfade=d=${fade.toFixed(3)}${audioOut}`);
    video = videoOut;
    audio = audioOut;
    cursor = offset + clips[index].length;
  }
  args.push(
    "-filter_complex",
    parts.join(";"),
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "film.mp4",
  );
  const result = await run(bin, args, dir);
  if (result.code !== 0) throw new Error(`Joining scenes failed. ${result.stderr.slice(-500)}`.trim());
}

export async function encodeFilm(opts: {
  dir: string;
  aspect: Aspect;
  scenes: { png: string; audio: string; cues: CaptionCue[]; planned?: number }[];
  onScene?: (done: number, total: number) => Promise<void> | void;
}): Promise<string> {
  if (!opts.scenes.length) throw new Error("Nothing to encode.");
  await mkdir(opts.dir, { recursive: true });
  await ensureFonts(opts.dir);
  const bin = ffmpegBin();
  const { width, height } = frameSize(opts.aspect);
  const zoomW = Math.round(width * 1.04);
  const zoomH = Math.round(height * 1.04);
  const clips: { name: string; length: number }[] = [];
  for (let index = 0; index < opts.scenes.length; index++) {
    const scene = opts.scenes[index];
    const id = String(index + 1).padStart(3, "0");
    const assName = `scene-${id}.ass`;
    const clipName = `scene-${id}.mp4`;
    const audioLen = await mediaDuration(scene.audio, opts.dir);
    const length = Math.max(audioLen, scene.planned ?? 0, 0.35);
    await writeFile(path.join(opts.dir, assName), buildAss(scene.cues, opts.aspect));
    const len = seconds(length);
    const result = await run(
      bin,
      [
        "-y",
        "-loop",
        "1",
        "-framerate",
        "30",
        "-i",
        scene.png,
        "-i",
        scene.audio,
        "-filter_complex",
        `[0:v]scale=${zoomW}:${zoomH},crop=${width}:${height}:x='(in_w-out_w)*min(1\\,0.2+0.6*t/${len})':y='(in_h-out_h)*min(1\\,0.35+0.25*t/${len})',fps=30,subtitles=${assName}:fontsdir=fonts,setsar=1[v];[1:a]apad,atrim=0:${len},asetpts=PTS-STARTPTS[a]`,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-t",
        len,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "stillimage",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "-g",
        "60",
        "-video_track_timescale",
        "30000",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-ar",
        "44100",
        "-ac",
        "2",
        clipName,
      ],
      opts.dir,
    );
    if (result.code !== 0) {
      throw new Error(`Encoding scene ${index + 1} failed. ${result.stderr.slice(-500)}`.trim());
    }
    clips.push({ name: clipName, length: Number(len) });
    await opts.onScene?.(index + 1, opts.scenes.length);
    await rm(scene.png, { force: true }).catch(() => undefined);
    await rm(scene.audio, { force: true }).catch(() => undefined);
  }

  const film = path.join(opts.dir, "film.mp4");
  await joinClips(opts.dir, clips);
  for (const clip of clips) await rm(path.join(opts.dir, clip.name), { force: true }).catch(() => undefined);
  return film;
}
