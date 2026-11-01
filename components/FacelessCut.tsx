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
import { clipsRequest } from "@/lib/cut/photo-request";
import { placePhotos, type PlaceItem } from "@/lib/cut/place-photos";

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

type PhotoRow = { status: "loading" | "ready" | "failed"; message: string };

const BRANDED = "Using the branded background.";

function missMessage(error?: string): string {
  if (error) return `${error} ${BRANDED}`;
  return `No matching photo. ${BRANDED}`;
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
  const [photoRows, setPhotoRows] = useState<PhotoRow[]>([]);
  const scenesRef = useRef<Scene[]>([]);
  const searchGen = useRef(0);
  const retrying = useRef(new Set<number>());
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
  scenesRef.current = scenes;

  function settlePhotos(next: Scene[], picks: (PlaceItem | null)[], error?: string) {
    const gaps = planGaps(picks.map(Boolean), next.map((scene) => scene.still), STILLS.map((still) => still.id));
    const placed: Scene[] = [];
    const rows: PhotoRow[] = [];
    next.forEach((scene, index) => {
      const pick = picks[index];
      const gap = gaps[index];
      if (pick) {
        placed.push({ ...scene, clip: pick.url });
        rows.push({ status: "ready", message: "" });
      } else if (gap.kind === "still") {
        placed.push({ ...scene, still: gap.id, clip: undefined });
        rows.push({ status: "failed", message: missMessage(error) });
      } else if (gap.kind === "carry") {
        placed.push({ ...scene, still: placed[gap.from]?.still ?? scene.still, clip: placed[gap.from]?.clip });
        rows.push({ status: "failed", message: missMessage(error) });
      } else {
        placed.push(scene);
        rows.push({ status: "failed", message: missMessage(error) });
      }
    });
    setScenes(placed);
    setPhotoRows(rows);
    const photos = picks.filter(Boolean).length;
    if (error && photos === 0) setPhotoNote(`${error} Scenes use the branded background. Retry any scene.`);
    else if (photos === next.length) setPhotoNote("Every scene has its own photo.");
    else setPhotoNote(`${photos} of ${next.length} scenes have a stock photo. The rest use the branded background.`);
    if (!scoring.current && !busy.current) setNote("Clips follow the lines. The script is spoken, not printed.");
  }

  async function retryScene(index: number) {
    if (retrying.current.has(index)) return;
    const gen = searchGen.current;
    const narration = scenesRef.current[index]?.narration;
    if (!narration) return;
    retrying.current.add(index);
    setPhotoRows((rows) => rows.map((row, i) => (i === index ? { status: "loading", message: "" } : row)));
    try {
      const { picks, error } = await placePhotos<PlaceItem>({
        lines: [narration],
        topic: title,
        fetchItems: (body) => clipsRequest(body),
        load: loadOk,
        retryDelayMs: 400,
      });
      if (gen !== searchGen.current) return;
      const pick = picks[0];
      if (pick) {
        setScenes((current) => current.map((scene, i) => (i === index ? { ...scene, clip: pick.url } : scene)));
        setPhotoRows((rows) => rows.map((row, i) => (i === index ? { status: "ready", message: "" } : row)));
        return;
      }
      setPhotoRows((rows) => rows.map((row, i) => (i === index ? { status: "failed", message: missMessage(error) } : row)));
    } catch (error) {
      if (gen !== searchGen.current) return;
      const message = error instanceof Error ? error.message : "Photo search failed.";
      setPhotoRows((rows) => rows.map((row, i) => (i === index ? { status: "failed", message: missMessage(message) } : row)));
    } finally {
      retrying.current.delete(index);
    }
  }

  useEffect(() => {
    const plan = directPlan(script);
    const next = plan.scenes;
    const gen = ++searchGen.current;
    setScenes(next);
    setCoverage({ lines: plan.lineCount, limit: overLimitNote(plan) });
    setPhotoRows(next.map(() => ({ status: "loading", message: "" })));
    setPhotoNote(next.length > 1 ? `Finding photos (0 of ${next.length} scenes)...` : "Finding photos...");
    let cancel = false;
    const stop = new AbortController();
    const found = new Map<number, string>();
    let shown = 0;
    // Photos show up as each one loads. A single batch used to leave the counter at 0 until the end.
    const showFound = () => {
      if (cancel || found.size === shown) return;
      shown = found.size;
      setScenes((current) => (current.length === next.length ? current.map((scene, index) => (found.has(index) ? { ...scene, clip: found.get(index) } : scene)) : current));
      setPhotoRows((rows) => rows.map((row, index) => (found.has(index) ? { status: "ready", message: "" } : row)));
      if (shown < next.length) setPhotoNote(`Finding photos (${shown} of ${next.length} scenes)...`);
    };
    // Same picker as the Faceless builder. No photo repeats anywhere in the video: failed loads take
    // unused spares, then a deeper search, then each built-in still once. Long scripts go in batches.
    const search = () => placePhotos<PlaceItem>({
      lines: next.map((scene) => scene.narration),
      topic: title,
      signal: stop.signal,
      fetchItems: (body) => clipsRequest(body, stop.signal),
      load: loadOk,
      onPick: (index, item) => {
        found.set(index, item.url);
        showFound();
      },
      onProgress: () => {
        if (cancel) return;
        showFound();
      },
    })
      .then(({ picks, error }) => {
        if (cancel || gen !== searchGen.current) return;
        settlePhotos(next, picks, error);
      })
      .catch((error: unknown) => {
        if (cancel || gen !== searchGen.current) return;
        const message = error instanceof Error ? error.message : "Photo search failed.";
        settlePhotos(next, next.map(() => null), message);
      });
    // Typing in the draft changes the script on every key, so the search waits for a pause.
    const timer = setTimeout(() => void search(), 600);
    return () => {
      cancel = true;
      clearTimeout(timer);
      stop.abort();
    };
    // The title only sharpens the photo search, so a title edit alone does not refetch.
    // settlePhotos is recreated each render and only reads the latest scenes for this script.
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
        {photoRows.length ? (
          <ul className="mt-3 space-y-2">
            {scenes.map((scene, index) => {
              const row = photoRows[index];
              return (
                <li key={`${scene.id}-${index}`} className="flex flex-wrap items-center gap-2 text-xs text-dark-300">
                  <span className="font-medium text-white">Scene {index + 1}</span>
                  <span className="min-w-0 max-w-[18rem] truncate text-dark-500">{scene.narration}</span>
                  {row?.status === "failed" ? (
                    <>
                      <span role="alert" className="text-amber-200">{row.message}</span>
                      <button
                        type="button"
                        onClick={() => void retryScene(index)}
                        className="px-2 py-1 rounded-lg border border-dark-700/40 text-dark-200 hover:text-white"
                      >
                        Retry
                      </button>
                    </>
                  ) : row?.status === "ready" ? (
                    <span className="text-emerald-300">Photo ready</span>
                  ) : (
                    <span>Finding photo...</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
