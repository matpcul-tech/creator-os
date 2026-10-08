import { voiceKey } from "@/lib/cut/direct";
import { estimateTimeline, sceneWindows } from "@/lib/cut/timeline";
import { frameSize, STILLS, type Aspect, type Camera, type Scene, type StillId, type WordMark } from "@/lib/cut/types";

export type EngineSnapshot = {
  time: number;
  duration: number;
  playing: boolean;
  recording: boolean;
  sceneIndex: number;
};

type Cut = {
  scenes: Scene[];
  brand: string;
  aspect: Aspect;
  music: boolean;
  words: WordMark[];
  duration: number;
};

const CREAM = "#f4f3f0";

export class CutEngine {
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private audio: AudioContext | null = null;
  private master: GainNode | null = null;
  private bed: { setLevel: (level: number) => void } | null = null;
  private images = new Map<StillId, HTMLImageElement>();
  private clips = new Map<string, HTMLImageElement>();
  private grain: HTMLCanvasElement | null = null;
  private cut: Cut = { scenes: [], brand: "CreatorAI", aspect: "16:9", music: true, words: [], duration: 1 };
  private voice: AudioBuffer | null = null;
  private voiceNode: AudioBufferSourceNode | null = null;
  private voiceId = "orion";
  private scoredKey = "";
  private time = 0;
  private playing = false;
  private recording = false;
  private alive = true;
  private raf = 0;
  private anchorCtx = 0;
  private anchorTime = 0;
  private lastEmit = 0;
  private lastScene = -1;
  private recorder: MediaRecorder | null = null;
  private recordSink: MediaStreamAudioDestinationNode | null = null;

  onChange: ((snapshot: EngineSnapshot) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas unavailable");
    this.ctx2d = context;
    this.resize();
  }

  async load(): Promise<void> {
    await Promise.all([
      document.fonts.load("500 16px Figtree"),
      document.fonts.load("600 40px Figtree"),
      document.fonts.load("400 96px 'Instrument Serif'"),
      ...STILLS.map(async (still) => {
        try {
          this.images.set(still.id, await loadImage(still.src));
        } catch {
          /* type still draws on a flat field */
        }
      }),
    ]);
    this.grain = makeGrain();
    this.draw();
    this.emit(true);
  }

  context(): AudioContext {
    return this.ensureAudio();
  }

  setCut(input: { scenes: Scene[]; brand: string; aspect: Aspect; music: boolean; voiceId: string }): void {
    const key = voiceKey(input.scenes, input.voiceId);
    const keepVoice = Boolean(this.voice) && this.scoredKey === key;
    if (!keepVoice) {
      this.voice = null;
      this.scoredKey = "";
      const estimate = estimateTimeline(input.scenes);
      this.cut = {
        scenes: input.scenes,
        brand: input.brand,
        aspect: input.aspect,
        music: input.music,
        words: estimate.words,
        duration: estimate.duration,
      };
    } else {
      this.cut = {
        ...this.cut,
        scenes: input.scenes,
        brand: input.brand,
        aspect: input.aspect,
        music: input.music,
      };
    }
    this.voiceId = input.voiceId;
    for (const scene of input.scenes) {
      if (scene.clip) void this.rememberClip(scene.clip);
    }
    this.resize();
    if (this.time > this.cut.duration) this.time = 0;
    this.applyMix();
    this.draw();
    this.emit(true);
  }

  setVoice(buffer: AudioBuffer, words: WordMark[], duration: number, key: string): void {
    if (voiceKey(this.cut.scenes, this.voiceId) !== key) return;
    this.voice = buffer;
    this.scoredKey = key;
    this.cut = { ...this.cut, words, duration: Math.max(duration, 0.8) };
    if (this.time > this.cut.duration) this.time = 0;
    this.applyMix();
    this.draw();
    this.emit(true);
  }

  /** Length of the cut in seconds: the measured voice when there is one, else the estimate. */
  length(): number {
    return this.cut.duration;
  }

  hasVoice(): boolean {
    return Boolean(this.voice) && this.scoredKey === voiceKey(this.cut.scenes, this.voiceId);
  }

  isRecording(): boolean {
    return this.recording;
  }

  seekScene(index: number): void {
    const windows = sceneWindows(this.cut.words, this.cut.scenes.length, this.cut.duration);
    this.seek(windows[index]?.start ?? 0);
  }

  play(): void {
    if (!this.cut.scenes.length) return;
    const audio = this.ensureAudio();
    if (this.time >= this.cut.duration - 0.08) this.time = 0;
    void audio.resume().then(() => {
      if (!this.alive) return;
      this.begin(this.time);
    });
  }

  pause(): void {
    this.playing = false;
    this.stopVoice();
    cancelAnimationFrame(this.raf);
    this.applyMix();
    this.draw();
    this.emit(true);
  }

  seek(time: number): void {
    this.time = clamp(time, 0, this.cut.duration);
    if (this.playing) this.begin(this.time);
    else {
      this.draw();
      this.emit(true);
    }
  }

  async record(): Promise<Blob> {
    if (!this.cut.scenes.length) throw new Error("Nothing to export");
    if (typeof MediaRecorder === "undefined") throw new Error("This browser can't export the file");
    const audio = this.ensureAudio();
    await audio.resume();
    this.pause();
    this.time = 0;
    this.draw();

    const sink = audio.createMediaStreamDestination();
    this.master?.connect(sink);
    this.recordSink = sink;
    const stream = this.canvas.captureStream(30);
    sink.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_500_000 } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        this.recording = false;
        this.detachSink();
        resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
        this.emit(true);
      };
      recorder.onerror = () => {
        this.recording = false;
        this.detachSink();
        reject(new Error("Export failed"));
      };
    });
    this.recorder = recorder;
    this.recording = true;
    recorder.start(200);
    this.begin(0);
    const timeout = window.setTimeout(() => {
      if (this.recording) this.finishRecording();
    }, (this.cut.duration + 5) * 1000);
    try {
      return await done;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  dispose(): void {
    this.alive = false;
    this.pause();
    this.finishRecording();
    void this.audio?.close();
  }

  private begin(offset: number): void {
    const audio = this.ensureAudio();
    this.stopVoice();
    this.time = offset;
    this.playing = true;
    this.anchorCtx = audio.currentTime;
    this.anchorTime = offset;
    this.startVoice(offset);
    this.applyMix();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
    this.emit(true);
  }

  private loop = (): void => {
    if (!this.alive) return;
    if (this.playing && this.audio) {
      this.time = this.anchorTime + (this.audio.currentTime - this.anchorCtx);
      if (this.time >= this.cut.duration) {
        this.time = this.cut.duration;
        this.playing = false;
        this.stopVoice();
        this.applyMix();
        this.draw();
        this.emit(true);
        this.finishRecording();
        return;
      }
    }
    this.draw();
    this.emit(false);
    if (this.playing) this.raf = requestAnimationFrame(this.loop);
  };

  private finishRecording(): void {
    const recorder = this.recorder;
    if (!recorder) return;
    this.recorder = null;
    if (recorder.state === "recording") recorder.stop();
    else {
      this.recording = false;
      this.detachSink();
    }
  }

  private detachSink(): void {
    if (this.recordSink && this.master) {
      try {
        this.master.disconnect(this.recordSink);
      } catch {
        /* already disconnected */
      }
    }
    this.recordSink = null;
  }

  private ensureAudio(): AudioContext {
    if (this.audio) return this.audio;
    const audio = new AudioContext();
    const master = audio.createGain();
    master.gain.value = 1;
    master.connect(audio.destination);
    this.audio = audio;
    this.master = master;
    this.bed = startBed(audio, master);
    this.applyMix();
    return audio;
  }

  private applyMix(): void {
    const level = this.playing && this.cut.music ? (this.voice ? 0.05 : 0.14) : 0;
    this.bed?.setLevel(level);
  }

  private startVoice(offset: number): void {
    if (!this.voice || !this.audio || !this.master) return;
    if (offset >= this.voice.duration) return;
    const node = this.audio.createBufferSource();
    node.buffer = this.voice;
    node.connect(this.master);
    node.start(0, Math.max(0, offset));
    this.voiceNode = node;
  }

  private stopVoice(): void {
    const node = this.voiceNode;
    this.voiceNode = null;
    if (!node) return;
    node.onended = null;
    try {
      node.stop();
    } catch {
      /* already stopped */
    }
  }

  private async rememberClip(src: string): Promise<void> {
    if (this.clips.has(src)) return;
    try {
      const image = await loadImage(src);
      if (!this.alive) return;
      this.clips.set(src, image);
      this.draw();
    } catch {
      /* keep the local still */
    }
  }

  private resize(): void {
    const { width, height } = frameSize(this.cut.aspect);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private emit(force: boolean): void {
    const sceneIndex = this.sceneIndex();
    const now = performance.now();
    if (!force && sceneIndex === this.lastScene && now - this.lastEmit < 120) return;
    this.lastEmit = now;
    this.lastScene = sceneIndex;
    this.onChange?.({
      time: this.time,
      duration: this.cut.duration,
      playing: this.playing,
      recording: this.recording,
      sceneIndex,
    });
  }

  private sceneIndex(): number {
    const windows = sceneWindows(this.cut.words, this.cut.scenes.length, this.cut.duration);
    let index = 0;
    windows.forEach((window, item) => {
      if (this.time >= window.start) index = item;
    });
    return index;
  }

  private draw(): void {
    const ctx = this.ctx2d;
    const { width: w, height: h } = this.canvas;
    const scenes = this.cut.scenes;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0c0c0d";
    ctx.fillRect(0, 0, w, h);
    if (!scenes.length) return;

    const windows = sceneWindows(this.cut.words, scenes.length, this.cut.duration);
    const index = this.sceneIndex();
    const scene = scenes[index];
    const span = windows[index] ?? { start: 0, end: this.cut.duration };
    const local = clamp((this.time - span.start) / Math.max(0.001, span.end - span.start), 0, 1);
    const unit = Math.min(w, h) / 720;

    const image = (scene.clip && this.clips.get(scene.clip)) || this.images.get(scene.still);
    if (image) drawCover(ctx, image, w, h, local, scene.camera);
    else {
      ctx.fillStyle = "#17171a";
      ctx.fillRect(0, 0, w, h);
    }

    const scrim = ctx.createLinearGradient(0, 0, 0, h);
    scrim.addColorStop(0, "rgba(8,8,9,0.12)");
    scrim.addColorStop(0.5, "rgba(8,8,9,0)");
    scrim.addColorStop(1, "rgba(8,8,9,0.22)");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);

    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.62);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    if (this.grain) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.drawImage(this.grain, 0, 0, w, h);
      ctx.restore();
    }

    const edge = Math.min(span.end - span.start, 0.36);
    let veil = 0;
    const into = this.time - span.start;
    const left = span.end - this.time;
    if (into < edge) veil = 1 - into / edge;
    if (left < edge * 0.7) veil = Math.max(veil, 1 - left / (edge * 0.7));
    if (veil > 0) {
      ctx.fillStyle = `rgba(12,12,13,${clamp(veil, 0, 1)})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(244,243,240,0.22)";
    ctx.fillRect(0, h - 4, w, 4);
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, h - 4, w * clamp(this.time / Math.max(this.cut.duration, 0.01), 0, 1), 4);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(src));
    image.src = src;
  });
}

function makeGrain(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const image = context.createImageData(160, 160);
  for (let index = 0; index < image.data.length; index += 4) {
    const value = 180 + Math.random() * 75;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 90;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  progress: number,
  camera: Camera,
): void {
  const frame = width / height;
  const picture = image.width / image.height;
  let drawWidth = picture > frame ? height * picture : width;
  let drawHeight = picture > frame ? height : width / picture;
  const zoom = camera === "hold" ? 1.08 : 1.08 + progress * 0.1;
  drawWidth *= zoom;
  drawHeight *= zoom;
  let x = (width - drawWidth) / 2;
  let y = (height - drawHeight) / 2;
  if (camera === "driftL") x -= progress * width * 0.045;
  if (camera === "driftR") x += progress * width * 0.045;
  if (camera === "rise") y -= progress * height * 0.05;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function startBed(audio: AudioContext, master: GainNode): { setLevel: (level: number) => void } {
  const gain = audio.createGain();
  gain.gain.value = 0;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 360;
  filter.connect(gain);
  gain.connect(master);

  const noiseBuffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let brown = 0;
  for (let index = 0; index < data.length; index++) {
    brown = brown * 0.98 + (Math.random() * 2 - 1) * 0.08;
    data[index] = brown * 2.4;
  }
  const noise = audio.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  noise.connect(filter);
  noise.start();

  const tone = audio.createGain();
  tone.gain.value = 0.35;
  tone.connect(gain);
  for (const frequency of [110, 164.81]) {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.connect(tone);
    osc.start();
  }

  return {
    setLevel(level: number) {
      gain.gain.cancelScheduledValues(audio.currentTime);
      gain.gain.linearRampToValueAtTime(level, audio.currentTime + 0.25);
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
