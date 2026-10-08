"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Image as ImageIcon, Loader2, Mic, RefreshCw } from "lucide-react";
import { fileNameFor, photoPlan, splitCards, type PhotoPlan } from "@/lib/cut/builder-cards";
import { creditFor, fitsCard } from "@/lib/cut/credit";
import { inBatches, planGaps } from "@/lib/cut/fill";
import { STILLS, type StillId } from "@/lib/cut/types";

type Scene = {
  caption: string;
  voice: string;
  plan: PhotoPlan;
  media: HTMLImageElement | null;
  credit: string;
  source: string;
  seconds: number;
  // Photo bookkeeping for the cards: loading skeleton, dedupe keys, and a friendly credit.
  loading?: boolean;
  photoSrc?: string;
  photoKey?: string;
  creditLabel?: string;
  creditUrl?: string;
};
type StockItem = { src: string; url: string; key?: string; title: string; credit: string; attribution?: string; provider?: string; text?: string };

type SceneQueries = { scenes: string[][]; topic: string[] };

function clean(value: string) {
  return value
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\*\*(?:ON-SCREEN TEXT|VOICEOVER|B-ROLL):\*\*/gi, " ")
    .replace(/^(?:on-screen text|voiceover|b-roll|caption|visual)\s*:\s*/i, "")
    .replace(/^#+\s*/, "")
    .replace(/^>\s*/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/[#＃*_>`~|]+/g, " ")
    .replace(/^["\u201c]|["\u201d]$/g, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}
function isHeading(line: string) {
  return /^(hook|setup|cta|beat|main|payoff|outro|intro|on-screen|voiceover|b-roll|captions?|hashes?|hashing|hashtags?)\b[:\s-]*$/i.test(line) || (/\d+:\d+/.test(line) && line.length < 48);
}
function parseScript(script: string): Scene[] {
  const chunks = script.split(/\n---\n|\n##+\s+/).map((c) => c.trim()).filter(Boolean);
  const labeled: Scene[] = [];
  for (const chunk of chunks) {
    const on = chunk.match(/\*\*ON-SCREEN TEXT:\*\*([\s\S]*?)(\*\*VOICEOVER:\*\*|\*\*B-ROLL:\*\*|$)/i);
    const voice = chunk.match(/\*\*VOICEOVER:\*\*([\s\S]*?)(\*\*ON-SCREEN TEXT:\*\*|\*\*B-ROLL:\*\*|$)/i);
    const roll = chunk.match(/\*\*B-ROLL:\*\*([\s\S]*?)(\*\*ON-SCREEN TEXT:\*\*|\*\*VOICEOVER:\*\*|$)/i);
    const captions = (on?.[1] || "").split(/\n+/).map(clean).filter((line) => line.length > 1);
    const spoken = clean((voice?.[1] || "").replace(/\n+/g, " "));
    if (!captions.length && !spoken) continue;
    const lines = captions.length ? captions : [spoken];
    const seconds = Math.max(4, (spoken || lines.join(" ")).split(/\s+/).filter(Boolean).length / 2.3);
    const roll0 = clean((roll?.[1] || "").split(/[.,]/)[0] || "");
    const base = photoPlan(spoken || lines[0]);
    const plan = roll0 ? { ...base, queries: [roll0, ...base.queries], tags: [...new Set([...roll0.toLowerCase().split(/\s+/), ...base.tags])] } : base;
    lines.forEach((caption) => labeled.push({ caption, voice: spoken || caption, plan, media: null, credit: "", source: "", seconds: seconds / lines.length }));
  }
  if (labeled.length) return labeled.slice(0, 60);
  const lines = script.split(/\n+/).map(clean).filter((line) => line.length > 1 && !isHeading(line));
  return splitCards(lines).map((caption) => ({
    caption,
    voice: caption,
    plan: photoPlan(caption),
    media: null,
    credit: "",
    source: "",
    seconds: Math.max(2.8, caption.split(/\s+/).length / 2.3),
  }));
}
// A photo that takes longer than this is skipped, so one slow image never holds up the rest.
const IMAGE_TIMEOUT_MS = 10000;

function loadImage(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), IMAGE_TIMEOUT_MS);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    // Same-origin proxy URLs keep their query; direct links drop tracking params.
    img.src = url.startsWith("/") ? url : url.split("?")[0];
  });
}
function cover(ctx: CanvasRenderingContext2D, media: CanvasImageSource, w: number, h: number, dx: number, dy: number, dw: number, dh: number) {
  const scale = Math.max(dw / w, dh / h);
  ctx.drawImage(media, dx + (dw - w * scale) / 2, dy + (dh - h * scale) / 2, w * scale, h * scale);
}
export function FacelessBuilder({
  script,
  title,
  contentId,
  onScriptChange,
}: {
  script: string;
  title: string;
  contentId?: number;
  onScriptChange?: (value: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scenesRef = useRef<Scene[]>([]);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const voiceFromFile = useRef(false);
  const mixRef = useRef<{ el: HTMLAudioElement; ctx: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);
  const [text, setText] = useState(script);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [status, setStatus] = useState("No B-roll needed. Photos come from the spoken lines.");
  const [fileUrl, setFileUrl] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [busy, setBusy] = useState(false);
  const shownRef = useRef<Set<string>>(new Set());
  // Photo search queries the AI wrote for this script, reused on every reshuffle.
  const queriesRef = useRef<{ sig: string; queries: SceneQueries } | null>(null);
  const findingRef = useRef(false);
  const [finding, setFinding] = useState(false);
  // Spare photos per card from its last swap, so the next swap is instant.
  const spareRef = useRef<Map<number, StockItem[]>>(new Map());
  const previewCount = useMemo(() => parseScript(text).length, [text]);
  useEffect(() => {
    setText(script);
    scenesRef.current = [];
    if (!voiceFromFile.current) voiceRef.current = null;
  }, [script]);

  function read() {
    const parsed = parseScript(text);
    scenesRef.current = parsed;
    setScenes(parsed);
    const total = parsed.reduce((n, s) => n + s.seconds, 0);
    setStatus(`${parsed.length} card${parsed.length === 1 ? "" : "s"}, about ${Math.round(total)} seconds. Find photos matches one photo per card.`);
    return parsed;
  }
  function paint(elapsed: number, list = scenesRef.current) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cards = list.length ? list : read();
    let cursor = 0;
    let idx = 0;
    for (let i = 0; i < cards.length; i++) {
      if (elapsed < cursor + cards[i].seconds || i === cards.length - 1) { idx = i; break; }
      cursor += cards[i].seconds;
    }
    const scene = cards[idx];
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, 720, 1280);
    if (scene?.media) cover(ctx, scene.media, scene.media.naturalWidth || 720, scene.media.naturalHeight || 800, 0, 0, 720, 1280);
    else { ctx.fillStyle = "#1c1b19"; ctx.fillRect(0, 0, 720, 1280); }
  }
  async function findStock() {
    // A second press while photos load would start a parallel search.
    if (findingRef.current) return scenesRef.current;
    findingRef.current = true;
    try {
      return await findStockOnce();
    } finally {
      findingRef.current = false;
    }
  }
  function updateCard(index: number, scene: Scene) {
    const next = scenesRef.current.slice();
    next[index] = scene;
    scenesRef.current = next;
    setScenes(next);
    if (index === 0 && scene.media) paint(0.2, next);
  }
  async function stillFor(scene: Scene, id: StillId): Promise<Scene> {
    const still = STILLS.find((entry) => entry.id === id) ?? STILLS[0];
    const media = await loadImage(still.src);
    return { ...scene, media, loading: false, credit: "Built-in still", source: `${still.label} (built-in)`, creditLabel: "Built-in still", creditUrl: "", photoSrc: "", photoKey: "" };
  }
  function withPhoto(scene: Scene, item: StockItem, media: HTMLImageElement): Scene {
    const label = creditFor(item);
    return { ...scene, media, loading: false, credit: item.credit, source: label, creditLabel: label, creditUrl: item.credit, photoSrc: item.src, photoKey: item.key ?? "" };
  }
  // Everything this video already uses, plus every photo shown before, so nothing repeats.
  function usedNow(except = -1): string[] {
    const keys: string[] = [];
    scenesRef.current.forEach((scene, index) => {
      if (index === except) return;
      if (scene.photoSrc) keys.push(scene.photoSrc);
      if (scene.photoKey) keys.push(scene.photoKey);
    });
    return [...new Set([...keys, ...shownRef.current])].slice(-400);
  }
  async function findStockOnce() {
    setBusy(true);
    setFinding(true);
    setStatus("Finding photos…");
    spareRef.current.clear();
    const parsed = read();
    // Show every card at once with a loading skeleton, then fill each one in as its photo arrives.
    scenesRef.current = parsed.map((scene) => ({ ...scene, loading: true }));
    setScenes(scenesRef.current);
    // Photos shown by an earlier Find photos press are skipped, so pressing it again reshuffles to new ones.
    const shown = shownRef.current;
    let items: (StockItem | null)[] = [];
    // Topic photos nobody uses yet, to stand in for any photo that fails to load.
    let spares: StockItem[] = [];
    const lines = parsed.map((s) => s.voice);
    const sig = JSON.stringify([title, lines]);
    const known = queriesRef.current?.sig === sig ? queriesRef.current.queries : undefined;
    try {
      const res = await fetch("/api/ai/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, topic: title, exclude: [...shown].slice(-400), extra: Math.min(12, lines.length), ...(known ? { queries: known } : {}) }),
      });
      const body = (await res.json()) as { items?: (StockItem | null)[]; pool?: StockItem[]; queries?: SceneQueries };
      items = body.items ?? [];
      spares = body.pool ?? [];
      if (body.queries) queriesRef.current = { sig, queries: body.queries };
    } catch {
      items = [];
    }
    setStatus("Loading photos…");
    const sceneQueries = queriesRef.current?.sig === sig ? queriesRef.current.queries.scenes : [];
    const missing: number[] = [];
    await inBatches(parsed, 3, async (scene, index) => {
      const own = items[index];
      // Try the card's own photo twice (a busy image host often answers the second time),
      // then a spare that fits this card's words, then a built-in still.
      const tries: StockItem[] = own ? [own, own] : [];
      for (let attempt = 0; attempt < tries.length + 2; attempt++) {
        let item: StockItem | undefined = tries[attempt];
        if (!item) {
          const at = spares.findIndex((spare) => fitsCard(spare, sceneQueries[index] ?? [scene.voice]));
          if (at < 0) break;
          item = spares.splice(at, 1)[0]; // taken synchronously, so two cards never get the same spare
        }
        if (attempt === 1 && item === own) await new Promise((resolve) => setTimeout(resolve, 1000));
        const media = await loadImage(item.url);
        if (media) {
          shown.add(item.src);
          if (item.key) shown.add(item.key);
          updateCard(index, withPhoto(scene, item, media));
          return;
        }
      }
      missing.push(index);
    });
    // Cards still without a photo: one deeper search that skips every photo already used.
    if (missing.length) {
      setStatus("Looking deeper for the last few photos…");
      const deeper = await fetch("/api/ai/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: missing.map((i) => parsed[i].voice),
          topic: title,
          exclude: [...new Set([...usedNow(), ...shown])].slice(-500),
          offset: 50,
          extra: Math.min(40, missing.length * 2),
          ...(sceneQueries.length === parsed.length ? { queries: { scenes: missing.map((i) => sceneQueries[i]), topic: queriesRef.current?.queries.topic ?? [] } } : {}),
        }),
      })
        .then((res) => res.json() as Promise<{ items?: (StockItem | null)[]; pool?: StockItem[] }>)
        .catch(() => ({}) as { items?: (StockItem | null)[]; pool?: StockItem[] });
      const queue = [...(deeper.items ?? []).map((item, k) => ({ item, k })), ...(deeper.pool ?? []).map((item) => ({ item, k: -1 }))];
      const taken = new Set(usedNow());
      for (const [k, index] of missing.slice().entries()) {
        // The card's own deeper match first, then any unused spare from the deeper search.
        const order = [...queue.filter((q) => q.k === k), ...queue.filter((q) => q.k === -1)];
        for (const { item } of order) {
          if (!item || taken.has(item.src) || (item.key && taken.has(item.key))) continue;
          taken.add(item.src);
          if (item.key) taken.add(item.key);
          const media = await loadImage(item.url);
          if (media) {
            shown.add(item.src);
            if (item.key) shown.add(item.key);
            updateCard(index, withPhoto(parsed[index], item, media));
            missing.splice(missing.indexOf(index), 1);
            break;
          }
        }
      }
    }
    // Last resort: each built-in still once, then the card holds the previous card's picture.
    const gaps = planGaps(
      scenesRef.current.map((card, index) => !missing.includes(index) && Boolean(card.media)),
      parsed.map((scene) => scene.plan.still),
      STILLS.map((still) => still.id),
    );
    for (const index of missing) {
      const gap = gaps[index];
      if (gap.kind === "still") updateCard(index, await stillFor(parsed[index], gap.id));
      else if (gap.kind === "carry") {
        const prev = scenesRef.current[gap.from];
        updateCard(index, { ...parsed[index], media: prev?.media ?? null, loading: false, credit: "Built-in still", source: "Holds the previous picture", creditLabel: "Holds the previous picture", creditUrl: "", photoSrc: "", photoKey: "" });
      }
    }
    const built = scenesRef.current;
    paint(0.2, built);
    setBusy(false);
    setFinding(false);
    const stock = built.filter((s) => s.credit !== "Built-in still").length;
    setStatus(
      `${built.length} cards. ${stock} matched a stock photo, ${built.length - stock} use a built-in still. Swap any card, or press Find photos again for a new set.`,
    );
    return built;
  }
  async function swapPhoto(index: number) {
    const scene = scenesRef.current[index];
    if (!scene || scene.loading || busy) return;
    updateCard(index, { ...scene, loading: true });
    const lines = [scene.voice];
    const all = queriesRef.current?.queries;
    const known = all?.scenes[index] ? { scenes: [all.scenes[index]], topic: all.topic } : undefined;
    try {
      // Spares from an earlier swap of this card come first, then a fresh search for just this line.
      const isUsed = (item: StockItem, used: Set<string>) => used.has(item.src) || Boolean(item.key && used.has(item.key));
      for (let round = 0; round < 2; round++) {
        const used = new Set(usedNow(index));
        if (scene.photoSrc) used.add(scene.photoSrc);
        if (scene.photoKey) used.add(scene.photoKey);
        let queue = round === 0 ? (spareRef.current.get(index) ?? []).filter((item) => !isUsed(item, used)) : [];
        if (!queue.length) {
          const res = await fetch("/api/ai/clips", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lines, topic: title, exclude: [...used].slice(-400), extra: 8, ...(known ? { queries: known } : {}) }),
          });
          const body = (await res.json()) as { items?: (StockItem | null)[]; pool?: StockItem[] };
          queue = [...(body.items ?? []), ...(body.pool ?? [])].filter((item): item is StockItem => Boolean(item) && !isUsed(item!, used));
          round = 1; // a server search is the last round
        }
        while (queue.length) {
          const item = queue.shift()!;
          const media = await loadImage(item.url);
          if (!media) continue;
          // Another card may have taken this photo while it loaded (two swaps at once).
          if (isUsed(item, new Set(usedNow(index)))) continue;
          spareRef.current.set(index, queue);
          if (scene.photoSrc) shownRef.current.add(scene.photoSrc);
          if (scene.photoKey) shownRef.current.add(scene.photoKey);
          shownRef.current.add(item.src);
          if (item.key) shownRef.current.add(item.key);
          updateCard(index, withPhoto(scenesRef.current[index] ?? scene, item, media));
          setStatus(`Card ${index + 1} has a new photo.`);
          return;
        }
      }
      updateCard(index, { ...scene, loading: false });
      setStatus(`No more new photos for card ${index + 1}. Edit the line to search for something else.`);
    } catch {
      updateCard(index, { ...scene, loading: false });
      setStatus("Photo search didn't answer. Try Swap photo again.");
    }
  }
  async function narrated(list: Scene[]): Promise<HTMLAudioElement | null> {
    const text = Array.from(new Set(list.map((s) => s.voice))).join(" ");
    if (!text.trim()) return null;
    try {
      const res = await fetch("/api/ai/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: "orion" }),
      });
      const body = (await res.json()) as { ok: boolean; audioBase64?: string; parts?: string[] };
      const parts = body.ok ? (body.parts?.length ? body.parts : body.audioBase64 ? [body.audioBase64] : []) : [];
      if (!parts.length) return null;
      const bytes = parts.map((part) => Uint8Array.from(atob(part), (c) => c.charCodeAt(0)));
      const audio = new Audio(URL.createObjectURL(new Blob(bytes, { type: "audio/mpeg" })));
      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => reject(new Error("voice unreadable"));
      });
      return audio;
    } catch {
      return null;
    }
  }
  async function ensureVoice(list: Scene[]): Promise<HTMLAudioElement | null> {
    if (voiceRef.current?.src) return voiceRef.current;
    setStatus("Scoring the voice…");
    const audio = await narrated(list);
    if (audio) voiceRef.current = audio;
    return audio;
  }
  async function speak() {
    const parsed = scenesRef.current.length ? scenesRef.current : read();
    const audio = await ensureVoice(parsed);
    if (audio) {
      setStatus(voiceFromFile.current ? "Playing your voice file." : "Playing the narrator voice. Make video records it into the file.");
      audio.currentTime = 0;
      await audio.play().catch(() => undefined);
      return;
    }
    setStatus("Narrator voice did not answer. Previewing with the browser voice, which is not recorded into the file.");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(Array.from(new Set(parsed.map((s) => s.voice))).join(" ")));
  }
  async function render() {
    if (busy) return;
    const found = scenesRef.current.some((s) => s.media) ? scenesRef.current : await findStock();
    const canvas = canvasRef.current;
    if (!canvas || !found.length) return;
    setBusy(true);
    const voice = await ensureVoice(found);
    setBusy(false);
    let list = found;
    if (voice && Number.isFinite(voice.duration) && voice.duration > 0.5) {
      // Stretch the cards so the picture lasts as long as the voice.
      const planned = found.reduce((n, s) => n + s.seconds, 0) || 1;
      const scale = (voice.duration + 0.4) / planned;
      list = found.map((s) => ({ ...s, seconds: s.seconds * scale }));
      scenesRef.current = list;
    }
    setStatus(voice ? "Recording picture and voice…" : "Voice did not answer. Recording the picture only.");
    const canvasStream = canvas.captureStream(30);
    let mixed: MediaStream = canvasStream;
    if (voice?.src) {
      if (!mixRef.current || mixRef.current.el !== voice) {
        // A media element can only be wired to one source node, so build this once per voice.
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        const source = ctx.createMediaElementSource(voice);
        source.connect(dest);
        source.connect(ctx.destination);
        mixRef.current = { el: voice, ctx, dest };
      }
      await mixRef.current.ctx.resume();
      mixed = new MediaStream([...canvasStream.getVideoTracks(), ...mixRef.current.dest.stream.getAudioTracks()]);
      voice.currentTime = 0;
      await voice.play();
    }
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";
    const rec = new MediaRecorder(mixed, { mimeType: mime });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { rec.onstop = resolve; });
    rec.start();
    const total = list.reduce((n, s) => n + s.seconds, 0);
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const id = window.setInterval(() => {
        const t = (performance.now() - started) / 1000;
        paint(t, list);
        if (t >= total) { window.clearInterval(id); resolve(); }
      }, 50);
    });
    rec.stop();
    voice?.pause();
    await done;
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    setFileUrl(url);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileNameFor(title, text);
    a.click();
    if (contentId) {
      const req = indexedDB.open("faceless-builder", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("cuts");
      req.onsuccess = () => req.result.transaction("cuts", "readwrite").objectStore("cuts").put(blob, String(contentId));
    }
    setStatus("Downloaded. Photos were matched from the lines, not from a B-roll block.");
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
      <canvas ref={canvasRef} width={720} height={1280} className="w-full max-w-[220px] rounded-2xl bg-black" />
      <div className="min-w-0">
        <label htmlFor="builder-script" className="text-xs font-medium text-dark-300 mb-1.5 block">
          Script. Paste it here. Each line becomes a card, and a paragraph is split by sentence.
        </label>
        <textarea
          id="builder-script"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onScriptChange?.(e.target.value);
            scenesRef.current = [];
            setScenes([]);
            spareRef.current.clear();
            if (!voiceFromFile.current) voiceRef.current = null;
          }}
          className="cai-input min-h-[160px] text-sm"
        />
        <p className="text-[11px] text-dark-500 mt-1">
          {previewCount} card{previewCount === 1 ? "" : "s"} from this script.
        </p>
        <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-dark-300">
          <Mic size={12} /> Voice file
          <input type="file" accept="audio/*" className="max-w-full text-[11px]" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            voiceRef.current = new Audio(URL.createObjectURL(file));
            voiceFromFile.current = true;
            setVoiceName(file.name);
          }} />
          {voiceName}
        </label>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={read} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white">Read script</button>
          <button onClick={findStock} disabled={busy} aria-busy={finding} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1 disabled:opacity-70">
            {finding ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} {finding ? "Finding photos..." : "Find photos"}
          </button>
          <button onClick={() => void speak()} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1"><Mic size={12} /> Play voice</button>
          <button onClick={render} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-brand-500/15 text-brand-400 flex items-center gap-1"><Download size={12} /> Make video</button>
          <a href={`/thumbnails?title=${encodeURIComponent(title)}`} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-dark-300 hover:text-white flex items-center gap-1"><ImageIcon size={12} /> Make thumbnail</a>
        </div>
        <p role="status" className="text-xs text-dark-500 mt-3">{status}</p>
        {scenes.length ? (
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Cards">
            {scenes.map((s, i) => (
              <li key={i} className="flex gap-2 rounded-xl border border-dark-700/50 bg-dark-800/30 p-2">
                <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-dark-700/60">
                  {s.loading ? (
                    <div className="h-full w-full animate-pulse bg-dark-600/60" aria-label="Loading photo" />
                  ) : s.media ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.media.src} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-dark-200 leading-snug line-clamp-2">
                    {i + 1}. {s.caption}
                  </p>
                  <p className="mt-0.5 text-[10px] text-dark-500 truncate">
                    {s.loading ? "Finding a photo..." : s.creditUrl ? (
                      <a href={s.creditUrl} target="_blank" rel="noreferrer" className="hover:text-dark-300 underline-offset-2 hover:underline">{s.creditLabel}</a>
                    ) : s.creditLabel || ""}
                  </p>
                  {s.media || s.loading ? (
                    <button
                      type="button"
                      onClick={() => void swapPhoto(i)}
                      disabled={s.loading || busy}
                      className="mt-1 inline-flex items-center gap-1 rounded-md bg-dark-700/50 px-2 py-0.5 text-[10px] text-dark-200 hover:text-white disabled:opacity-50"
                    >
                      <RefreshCw size={10} className={s.loading && !finding ? "animate-spin" : ""} /> Swap photo
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {fileUrl ? <video src={fileUrl} controls className="mt-3 w-full max-w-[220px] rounded-xl" /> : null}
      </div>
    </div>
  );
}

export function FacelessCut(props: { script: string; title: string; contentId?: number }) {
  return <FacelessBuilder {...props} />;
}
