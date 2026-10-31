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
  await copyFile(fonts.regular, path.join(dest, "DejaVuSans.ttf"));
  await copyFile(fonts.bold, path.join(dest, "DejaVuSans-Bold.ttf"));
}

export async function encodeFilm(opts: {
  dir: string;
  aspect: Aspect;
  scenes: { png: string; audio: string; cues: CaptionCue[]; planned?: number }[];
  onScene?: (done: number, total: number) => Promise<void> | void;
}): Promise<string> {
  if (!opts.scenes.length) throw new Error("Nothing to encode.");
  await ensureFonts(opts.dir);
  const bin = ffmpegBin();
  const { width, height } = frameSize(opts.aspect);
  const clips: string[] = [];
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
        `[0:v]fps=30,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,subtitles=${assName}:fontsdir=fonts,setsar=1[v];[1:a]apad,atrim=0:${len},asetpts=PTS-STARTPTS[a]`,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-t",
        len,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
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
    clips.push(clipName);
    await opts.onScene?.(index + 1, opts.scenes.length);
    await rm(scene.png, { force: true }).catch(() => undefined);
    await rm(scene.audio, { force: true }).catch(() => undefined);
  }

  const film = path.join(opts.dir, "film.mp4");
  if (clips.length === 1) {
    const result = await run(bin, ["-y", "-i", clips[0], "-c", "copy", "-movflags", "+faststart", "film.mp4"], opts.dir);
    if (result.code !== 0) throw new Error(`Saving the film failed. ${result.stderr.slice(-400)}`.trim());
  } else {
    const list = clips.map((name) => `file '${name}'`).join("\n");
    await writeFile(path.join(opts.dir, "concat.txt"), `${list}\n`);
    const result = await run(
      bin,
      ["-y", "-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "-movflags", "+faststart", "film.mp4"],
      opts.dir,
    );
    if (result.code !== 0) throw new Error(`Joining scenes failed. ${result.stderr.slice(-400)}`.trim());
  }
  for (const name of clips) await rm(path.join(opts.dir, name), { force: true }).catch(() => undefined);
  return film;
}
