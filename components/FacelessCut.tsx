"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Pause, Play, Sparkles } from "lucide-react";
import { CutEngine, type EngineSnapshot } from "@/lib/cut/engine";
import { directPlan, voiceKey } from "@/lib/cut/direct";
import { fmtTime, marksFromSpans } from "@/lib/cut/timeline";
import { overLimitNote } from "@/lib/cut/scenes";
import { voiceTrack } from "@/lib/cut/voice-track";
import { ASPECTS, STILLS, VOICES, aspectRatio, type Aspect, type Scene } from "@/lib/cut/types";
import { planGaps } from "@/lib/cut/fill";
import { placePhotos } from "@/lib/cut/place-photos";

// True once the photo has loaded. The engine then finds it in the browser cache.
function loadOk(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => resolve(false), 10000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    image.src = url;
  });
}

// Sharpen rewrites the on-picture lines for up to 8 scenes per request.
const SHARPEN_BATCH = 8;

// One photo request. A busy server (429) is waited out once, as it asks.
async function clipsRequest(body: Record<string, unknown>) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("/api/ai/clips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 429 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(10, Number(res.headers.get("retry-after")) || 3) * 1000));
      continue;
    }
    return res.json();
  }
}

export function FacelessCut({ script, title }: { script: string; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CutEngine | null>(null);
  const busy = useRef(false);
  const failedVoice = useRef("");
  const scoring = useRef(false);
  const [scenes, setScenes] = useState<Scene[]>(() => directPlan(script).scenes);
  // Lines in the script, and a plain note if a script is too long for one video (never silent).
  const [coverage, setCoverage] = useState(() => {
    const plan = directPlan(script);
    return { lines: plan.lineCount, limit: overLimitNote(plan) };
  });
  const [photoNote, setPhotoNote] = useState("");
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
    const plan = directPlan(script);
    const next = plan.scenes;
    setScenes(next);
    setCoverage({ lines: plan.lineCount, limit: overLimitNote(plan) });
    setPhotoNote(next.length > 1 ? `Finding photos (0 of ${next.length} scenes)…` : "Finding photos…");
    let cancel = false;
    const stop = new AbortController();
    const found = new Map<number, string>();
    let shown = 0;
    // Photos show up batch by batch, so a long script is watchable before every photo is in.
    const showFound = () => {
      if (cancel || found.size === shown) return;
      shown = found.size;
      setScenes((current) => (current.length === next.length ? current.map((scene, index) => (found.has(index) ? { ...scene, clip: found.get(index) } : scene)) : current));
    };
    // Same picker as the Faceless builder. No photo repeats anywhere in the video: failed loads take
    // unused spares, then a deeper search, then each built-in still once. Long scripts go in batches.
    const search = () => placePhotos<{ src: string; url: string; key?: string }>({
      lines: next.map((scene) => scene.narration),
      topic: title,
      signal: stop.signal,
      fetchItems: (body) => clipsRequest(body),
      load: loadOk,
      onPick: (index, item) => found.set(index, item.url),
      onProgress: (done, total) => {
        if (cancel) return;
        showFound();
        if (done < total) setPhotoNote(`Finding photos (${done} of ${total} scenes)…`);
      },
    })
      .then(({ picks }) => {
        if (cancel) return;
        const gaps = planGaps(picks.map(Boolean), next.map((scene) => scene.still), STILLS.map((still) => still.id));
        const placed: Scene[] = [];
        next.forEach((scene, index) => {
          const pick = picks[index];
          const gap = gaps[index];
          if (pick) placed.push({ ...scene, clip: pick.url });
          else if (gap.kind === "still") placed.push({ ...scene, still: gap.id, clip: undefined });
          else if (gap.kind === "carry") placed.push({ ...scene, still: placed[gap.from]?.still ?? scene.still, clip: placed[gap.from]?.clip });
          else placed.push(scene);
        });
        setScenes(placed);
        const photos = picks.filter(Boolean).length;
        setPhotoNote(photos === next.length ? `Every scene has its own photo.` : `${photos} of ${next.length} scenes have a stock photo. The rest use a built-in still.`);
        if (!scoring.current && !busy.current) setNote("Clips follow the lines. The script is spoken, not printed.");
      })
      .catch(() => setPhotoNote(""));
    // Typing in the draft changes the script on every key, so the search waits for a pause.
    const timer = setTimeout(() => void search(), 600);
    return () => {
      cancel = true;
      clearTimeout(timer);
      stop.abort();
    };
    // The title only sharpens the photo search, so a title edit alone does not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // True when the whole script is voiced. Any scene the voice cannot read stops it with a plain note,
  // so the cut never plays or exports with part of the narration missing.
  async function ensureVoice(retry = false): Promise<boolean> {
    const engine = engineRef.current;
    if (!engine || !voiceReady) return false;
    if (engine.hasVoice()) return true;
    const key = voiceKey(scenes, voiceId);
    if (failedVoice.current === key && !retry) return false;
    scoring.current = true;
    setNote("Scoring the voice…");
    try {
      const track = await voiceTrack({
        segments: scenes.map((scene) => scene.narration),
        voiceId,
        context: engine.context(),
        onProgress: (done, total) => {
          if (total > 1) setNote(`Scoring the voice (${done} of ${total} parts)…`);
        },
      });
      if (!track.ok) {
        failedVoice.current = key;
        setNote(`${track.error} Press Play or Export to try again.`);
        return false;
      }
      const timed = marksFromSpans(scenes, track.spans, track.total);
      engine.setVoice(track.buffer, timed.words, timed.duration, key);
      failedVoice.current = "";
      const voice = VOICES.find((item) => item.id === voiceId);
      setNote(
        `Voiced all ${scenes.length} scenes with ${voice?.label ?? "the narrator"} (${fmtTime(timed.duration)}). Export writes picture, voice, and music into one file.`,
      );
      return true;
    } catch {
      failedVoice.current = key;
      setNote("Voice didn't come through. Press Play or Export to try again.");
      return false;
    } finally {
      scoring.current = false;
    }
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
      // Without the full voice the picture still previews, and the note says why there is no voice.
      if (voiceReady && !engine.hasVoice()) await ensureVoice(failedVoice.current !== "");
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
    if (!engine || clock.recording) return;
    if (busy.current) {
      setNote("Still scoring the voice. Export will be ready in a moment.");
      return;
    }
    busy.current = true;
    try {
      // The file always carries the whole script. If any scene could not be voiced, stop and say so.
      if (voiceReady && !(await ensureVoice(true))) return;
      setNote(`Playing through once to write the file (${fmtTime(engine.length())}).`);
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
    const narrations = scenes.map((scene) => scene.narration);
    const total = Math.ceil(narrations.length / SHARPEN_BATCH);
    const cards: ({ onscreen: string; layout: Scene["layout"]; still: Scene["still"] } | undefined)[] = [];
    let stopped = "";
    for (let batch = 0; batch < total; batch++) {
      setNote(total > 1 ? `Sharpening the on-screen lines (${batch} of ${total} parts)…` : "Sharpening the on-screen lines…");
      try {
        const res = await fetch("/api/ai/sharpen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ narrations: narrations.slice(batch * SHARPEN_BATCH, (batch + 1) * SHARPEN_BATCH) }),
        });
        const result = (await res.json()) as {
          ok: boolean;
          error?: string;
          cards?: { onscreen: string; layout: Scene["layout"]; still: Scene["still"] }[];
        };
        if (!result.ok || !result.cards) {
          stopped = result.error || "Sharpen didn't answer.";
          break;
        }
        cards.push(...result.cards);
      } catch {
        stopped = "Sharpen didn't answer.";
        break;
      }
    }
    if (!cards.length) {
      setNote(stopped || "Sharpen didn't answer.");
      return;
    }
    const last = scenes.length - 1;
    setScenes((current) =>
      current.map((scene, index) => {
        const card = cards[index];
        if (!card) return scene;
        // Each part marks its own first and last card; only the video's first and last keep those looks.
        const layout = index === 0 ? "hook" : index === last ? "close" : card.layout === "hook" || card.layout === "close" ? "statement" : card.layout;
        return { ...scene, onscreen: card.onscreen || scene.onscreen, layout: layout || scene.layout, still: card.still || scene.still };
      }),
    );
    setNote(
      stopped
        ? `Sharpened scenes 1 to ${cards.length} of ${scenes.length}. The rest kept their lines: ${stopped}`
        : "Lines sharpened. What is spoken stayed the same.",
    );
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
          Faceless. {scenes.length} scenes from {coverage.limit ? "this script" : `all ${coverage.lines} lines of this script`}, about {fmtTime(clock.duration)}. The words stay off the picture. Play scores a voice with no key, and export is one file.
        </p>
        {coverage.limit ? (
          <p role="alert" className="text-xs text-amber-300 mb-3">
            {coverage.limit}
          </p>
        ) : null}
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
        <p role="status" className="text-xs text-dark-500 mt-3">{note}</p>
        {photoNote ? <p className="text-xs text-dark-500 mt-1">{photoNote}</p> : null}
      </div>
    </div>
  );
}
