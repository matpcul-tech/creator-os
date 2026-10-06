"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Pause, Play, Sparkles } from "lucide-react";
import { CutEngine, type EngineSnapshot } from "@/lib/cut/engine";
import { directScript, spokenScript, voiceKey } from "@/lib/cut/direct";
import { marksFromVoice } from "@/lib/cut/timeline";
import { ASPECTS, VOICES, aspectRatio, type Aspect, type Scene } from "@/lib/cut/types";

type VoicePayload =
  | { ok: false; error: string }
  | {
      ok: true;
      audioBase64: string;
      parts?: string[];
      duration: number;
      chars: string[];
      times: { start: number; end: number }[];
    };

function voiceChunks(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]?/g) ?? [text];
  const out: string[] = [];
  let buf = "";
  for (const raw of parts) {
    const piece = raw.trim();
    if (!piece) continue;
    const next = buf ? `${buf} ${piece}` : piece;
    if (next.length > 700 && buf) {
      out.push(buf);
      buf = piece;
    } else {
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out.length ? out : [text];
}

async function fetchVoice(text: string, voiceId: string): Promise<VoicePayload> {
  try {
    const res = await fetch("/api/ai/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId }),
    });
    return (await res.json()) as VoicePayload;
  } catch {
    return { ok: false, error: "Voice didn't answer" };
  }
}

function decodeMp3(context: AudioContext, base64: string): Promise<AudioBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return context.decodeAudioData(bytes.buffer.slice(0));
}

function joinBuffers(context: AudioContext, buffers: AudioBuffer[]): AudioBuffer {
  const channels = buffers[0]?.numberOfChannels ?? 1;
  const rate = buffers[0]?.sampleRate ?? 24000;
  const length = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const gap = Math.round(rate * 0.18);
  const mixed = context.createBuffer(channels, Math.max(1, length + gap * Math.max(0, buffers.length - 1)), rate);
  let offset = 0;
  for (const buffer of buffers) {
    const channelCount = Math.min(channels, buffer.numberOfChannels);
    for (let channel = 0; channel < channelCount; channel += 1) {
      mixed.getChannelData(channel).set(buffer.getChannelData(channel), offset);
    }
    offset += buffer.length + gap;
  }
  return mixed;
}

export function FacelessCut({ script, title }: { script: string; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CutEngine | null>(null);
  const busy = useRef(false);
  const failedVoice = useRef("");
  const [scenes, setScenes] = useState<Scene[]>(() => directScript(script));
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [voiceId, setVoiceId] = useState("orion");
  const [music, setMusic] = useState(true);
  const [voiceReady, setVoiceReady] = useState(false);
  const [box, setBox] = useState({ width: 220, height: 391 });
  const [clock, setClock] = useState<EngineSnapshot>({
    time: 0,
    duration: 1,
    playing: false,
    recording: false,
    sceneIndex: 0,
  });
  const [note, setNote] = useState("No face. The script is spoken, not printed on the picture.");

  useEffect(() => {
    const next = directScript(script);
    setScenes(next);
    let cancel = false;
    fetch("/api/ai/clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: next.map((scene) => scene.narration) }),
    })
      .then((res) => res.json())
      .then((body: { clips?: (string | null)[] }) => {
        if (cancel || !body.clips?.length) return;
        setScenes(
          next.map((scene, index) => (body.clips?.[index] ? { ...scene, clip: body.clips[index] as string } : scene)),
        );
        setNote("Clips follow the lines. The script is spoken, not printed.");
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [script]);

  useEffect(() => {
    fetch("/api/ai/narrate")
      .then((res) => res.json())
      .then((body: { ready?: boolean }) => {
        setVoiceReady(Boolean(body.ready));
        if (!body.ready) setNote("Picture plays now. Voice will score when you hit Play.");
      })
      .catch(() => setVoiceReady(false));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new CutEngine(canvas);
    engineRef.current = engine;
    engine.onChange = setClock;
    void engine.load();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setCut({
      scenes,
      brand: (title || "CreatorAI").slice(0, 28),
      aspect,
      music,
      voiceId,
    });
  }, [scenes, title, aspect, music, voiceId]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const ratio = aspectRatio(aspect);
    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      const width = Math.min(rect.width, 280);
      setBox({ width, height: width / ratio });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [aspect]);

  async function ensureVoice() {
    const engine = engineRef.current;
    if (!engine || !voiceReady || engine.hasVoice()) return;
    const { spoken, ranges } = spokenScript(scenes);
    const key = voiceKey(scenes, voiceId);
    if (failedVoice.current === key) return;
    setNote("Scoring the voice…");
    const chunks = voiceChunks(spoken);
    const buffers = [];
    for (const chunk of chunks) {
      let result = await fetchVoice(chunk, voiceId);
      if (!result.ok && chunk.length > 160) {
        const halves = [chunk.slice(0, Math.ceil(chunk.length / 2)), chunk.slice(Math.ceil(chunk.length / 2))];
        for (const half of halves) {
          result = await fetchVoice(half, voiceId);
          if (!result.ok) continue;
          const clips = result.parts?.length ? result.parts : [result.audioBase64];
          for (const clip of clips) buffers.push(await decodeMp3(engine.context(), clip));
        }
        continue;
      }
      if (!result.ok) {
        failedVoice.current = key;
        setNote("Voice missed a line. Playing the rest of the cut.");
        continue;
      }
      const clips = result.parts?.length ? result.parts : [result.audioBase64];
      for (const clip of clips) buffers.push(await decodeMp3(engine.context(), clip));
    }
    if (!buffers.length) {
      failedVoice.current = key;
      setNote("Voice didn't come through. Playing the picture cut.");
      return;
    }
    const buffer = joinBuffers(engine.context(), buffers);
    const timed = marksFromVoice(scenes, spoken, ranges, [], [], buffer.duration);
    engine.setVoice(buffer, timed.words, timed.duration, key);
    failedVoice.current = "";
    const voice = VOICES.find((item) => item.id === voiceId);
    setNote(`Voiced with ${voice?.label ?? "the narrator"}. Export writes picture, voice, and music into one file.`);
  }

  async function onPlay() {
    const engine = engineRef.current;
    if (!engine || busy.current) return;
    if (clock.playing && !clock.recording) {
      engine.pause();
      return;
    }
    busy.current = true;
    try {
      if (voiceReady && !engine.hasVoice()) await ensureVoice();
      engine.play();
    } catch {
      setNote("Voice didn't come through. Playing the picture cut.");
      engine.play();
    } finally {
      busy.current = false;
    }
  }

  async function onExport() {
    const engine = engineRef.current;
    if (!engine || busy.current || clock.recording) return;
    busy.current = true;
    setNote("Playing through once to write the file.");
    try {
      await ensureVoice();
      const blob = await engine.record();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(title || "faceless-cut").slice(0, 40).replace(/\s+/g, "-")}.webm`;
      link.click();
      URL.revokeObjectURL(url);
      setNote("Downloaded. No face in the file. Upload it from Publish.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Export failed");
    } finally {
      busy.current = false;
    }
  }

  async function onSharpen() {
    engineRef.current?.pause();
    setNote("Sharpening the on-screen lines…");
    try {
      const res = await fetch("/api/ai/sharpen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrations: scenes.map((scene) => scene.narration) }),
      });
      const result = (await res.json()) as {
        ok: boolean;
        error?: string;
        cards?: { onscreen: string; layout: Scene["layout"]; still: Scene["still"] }[];
      };
      if (!result.ok || !result.cards) {
        setNote(result.error || "Sharpen didn't answer.");
        return;
      }
      setScenes((current) =>
        current.map((scene, index) => ({
          ...scene,
          onscreen: result.cards?.[index]?.onscreen || scene.onscreen,
          layout: result.cards?.[index]?.layout || scene.layout,
          still: result.cards?.[index]?.still || scene.still,
        })),
      );
      setNote("Lines sharpened. What is spoken stayed the same.");
    } catch {
      setNote("Sharpen didn't answer.");
    }
  }

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-6 items-start">
      <div ref={stageRef} className="w-full max-w-[280px]">
        <div className="overflow-hidden rounded-2xl bg-dark-950" style={{ width: box.width, height: box.height }}>
          <canvas ref={canvasRef} className="block h-full w-full" aria-label="Faceless video preview" />
        </div>
      </div>
      <div>
        <p className="text-sm text-dark-300 mb-3">
          Faceless. {scenes.length} scenes from this script. The words stay off the picture. Play scores a voice with no key, and export is one file.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {ASPECTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setAspect(item)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                aspect === item
                  ? "bg-brand-500/15 border-brand-500/40 text-brand-300"
                  : "bg-dark-800/40 border-dark-700/40 text-dark-300"
              }`}
            >
              {item}
            </button>
          ))}
          <select
            value={voiceId}
            onChange={(event) => setVoiceId(event.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800/40 border border-dark-700/40 text-white"
            aria-label="Voice"
          >
            {VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label} · {voice.note}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setMusic((on) => !on)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              music ? "bg-brand-500/15 border-brand-500/40 text-brand-300" : "bg-dark-800/40 border-dark-700/40 text-dark-400"
            }`}
            aria-pressed={music}
          >
            Music
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onPlay()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800/40 text-white flex items-center gap-1"
          >
            {clock.playing && !clock.recording ? <Pause size={12} /> : <Play size={12} />}
            {clock.playing && !clock.recording ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => void onSharpen()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800/40 text-white flex items-center gap-1"
          >
            <Sparkles size={12} /> Sharpen lines
          </button>
          <button
            type="button"
            onClick={() => void onExport()}
            disabled={clock.recording}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/15 text-brand-400 flex items-center gap-1 disabled:opacity-40"
          >
            <Download size={12} /> {clock.recording ? "Writing" : "Export video"}
          </button>
        </div>
        <p className="text-xs text-dark-500 mt-3">{note}</p>
      </div>
    </div>
  );
}
