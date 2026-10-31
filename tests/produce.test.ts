import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { spawn } from "child_process";
import os from "os";
import path from "path";
import { authorizeProduce } from "../lib/produce/auth";
import { cardsFromScript } from "../lib/produce/cards";
import { buildAss, cuesFromAlignment, type Alignment } from "../lib/produce/captions";
import { encodeFilm, ffmpegBin } from "../lib/produce/ffmpeg";
import { parseProduceBody } from "../lib/produce/validate";
import { parseVisual, renderScenePng, sceneSvg } from "../lib/produce/visuals";

const alignment: Alignment = {
  characters: ["H", "i", " ", "t", "h", "e", "r", "e", "."],
  starts: [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.7],
  ends: [0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.7, 0.82],
};

test("scene cards keep every spoken line and pick a visual", () => {
  const script = [
    "Start before you feel ready and the work gets easier.",
    "Sleep 8 and focus 6 is the whole plan.",
    "Then ship the film and watch what happens next.",
  ].join("\n");
  const cards = cardsFromScript(script, "Morning rule");
  assert.ok(cards.length >= 2);
  assert.match(cards.map((card) => card.narration).join(" "), /Start before/);
  assert.match(cards.map((card) => card.narration).join(" "), /watch what happens/);
  assert.ok(cards.every((card) => card.visual && card.duration >= 2));
  assert.equal(cards.some((card) => card.visual.startsWith("bar:")), true);
});

test("produce body accepts a locked voice and scene cards", () => {
  const body = parseProduceBody({
    title: "Three beats",
    aspect: "9:16",
    voice: {
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      stability: 0.4,
      similarity_boost: 0.8,
      style: 0.1,
      use_speaker_boost: true,
      speed: 1,
    },
    scenes: [
      { title: "Open", narration: "This is the opening line of the film.", visual: "big-text: Open", duration: 3 },
    ],
  });
  assert.equal(body.aspect, "9:16");
  assert.equal(body.voice.similarity_boost, 0.8);
  assert.equal(body.scenes[0].visual, "big-text: Open");
  assert.throws(() => parseProduceBody({ title: "X", voice: { voiceId: "short" }, scenes: [] }), /voiceId/);
});

test("long form format maps to 16:9", () => {
  const body = parseProduceBody({
    title: "Desk tour",
    format: "long",
    script: "A wide frame holds the chart and the closing line for the whole idea.",
    voice: { voiceId: "21m00Tcm4TlvDq8ikWAM" },
  });
  assert.equal(body.aspect, "16:9");
  assert.ok(body.scenes.length >= 1);
});

test("character timings become caption cues and an ASS script", () => {
  const cues = cuesFromAlignment(alignment, 1.2);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, "Hi there.");
  assert.ok(cues[0].start < 0.2);
  assert.ok(cues[0].end > 0.7);
  const ass = buildAss(cues, "9:16");
  assert.match(ass, /PlayResX: 1080/);
  assert.match(ass, /PlayResY: 1920/);
  assert.match(ass, /Hi there\./);
  assert.equal(ass.includes("\u2014"), false);
});

test("visuals parse charts, diagrams, and big type", () => {
  assert.equal(parseVisual("bar: Sleep 8 | Focus 6", "Plan").kind, "bar");
  assert.equal(parseVisual("line: 2, 5, 9", "Trend").kind, "line");
  assert.equal(parseVisual("diagram: Hook > Proof > Close", "Steps").kind, "diagram");
  assert.equal(parseVisual("big-text: Ship it", "Title").kind, "big-text");
  const svg = sceneSvg(
    { title: "Plan", narration: "Sleep and focus.", visual: "bar: Sleep 8 | Focus 6", duration: 4 },
    "9:16",
    0,
    3,
    "Creator OS",
  );
  assert.match(svg, /Sleep/);
  assert.match(svg, /#3DDC97/);
  assert.equal(svg.includes("\u2014"), false);
  const png = renderScenePng(svg, "9:16");
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1920);
});

test("bearer auth compares the token without accepting a mismatch", () => {
  const prev = process.env.CREATOR_OS_API_TOKEN;
  process.env.CREATOR_OS_API_TOKEN = "unit-test-token-value";
  try {
    assert.equal(authorizeProduce(null).ok, true);
    assert.equal(authorizeProduce("Bearer unit-test-token-value").ok, true);
    const bad = authorizeProduce("Bearer unit-test-token-other");
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.status, 401);
  } finally {
    if (prev === undefined) delete process.env.CREATOR_OS_API_TOKEN;
    else process.env.CREATOR_OS_API_TOKEN = prev;
  }
});

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-400)));
    });
  });
}

test("ffmpeg joins scene clips with audio and burned in captions", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "produce-test-"));
  try {
    const bin = ffmpegBin();
    const scenes = [
      { text: "Hello from scene one.", freq: "440" },
      { text: "And this is scene two.", freq: "554" },
    ];
    const built = [];
    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];
      const audio = path.join(dir, `tone-${index}.wav`);
      await run(bin, ["-y", "-f", "lavfi", "-i", `sine=frequency=${scene.freq}:duration=1.1`, audio]);
      const png = path.join(dir, `card-${index}.png`);
      const svg = sceneSvg(
        { title: scene.text, narration: scene.text, visual: `big-text: ${scene.text}`, duration: 1 },
        "9:16",
        index,
        scenes.length,
        "Creator OS",
      );
      await writeFile(png, renderScenePng(svg, "9:16"));
      built.push({
        png,
        audio,
        planned: 1,
        cues: [{ text: scene.text, start: 0.15, end: 0.95 }],
      });
    }
    const wide = [];
    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];
      const audio = path.join(dir, `wide-${index}.wav`);
      await run(bin, ["-y", "-f", "lavfi", "-i", `sine=frequency=${scene.freq}:duration=1.0`, audio]);
      const png = path.join(dir, `wide-card-${index}.png`);
      await writeFile(
        png,
        renderScenePng(
          sceneSvg(
            { title: scene.text, narration: scene.text, visual: index === 1 ? "diagram: Hook > Proof > Close" : "line: 2, 4, 7", duration: 1 },
            "16:9",
            index,
            scenes.length,
            "Creator OS",
          ),
          "16:9",
        ),
      );
      wide.push({ png, audio, planned: 1, cues: [{ text: scene.text, start: 0.1, end: 0.8 }] });
    }

    const vertical = await encodeFilm({ dir, aspect: "9:16", scenes: built });
    const verticalInfo = await probe(bin, vertical);
    assert.match(verticalInfo, /1080x1920/);
    assert.match(verticalInfo, /Audio:/);
    const frame = path.join(dir, "frame.rgb");
    await run(bin, ["-y", "-ss", "0.45", "-i", vertical, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", frame]);
    const raw = await readFile(frame);
    const width = 1080;
    const height = 1920;
    let bright = 0;
    const y0 = height - 280;
    for (let y = y0; y < y0 + 80; y++) {
      for (let x = 200; x < width - 200; x++) {
        const i = (y * width + x) * 3;
        if (raw[i] > 200 && raw[i + 1] > 200 && raw[i + 2] > 200) bright += 1;
      }
    }
    assert.ok(bright > 30, `expected burned in caption pixels, saw ${bright}`);

    const horizontal = await encodeFilm({ dir: path.join(dir, "wide"), aspect: "16:9", scenes: wide });
    // encodeFilm writes into opts.dir, which must already exist. Recreate properly below if this throws.
    assert.match(await probe(bin, horizontal), /1920x1080/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function probe(bin: string, file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["-hide_banner", "-i", file, "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", () => resolve(stderr));
  });
}
