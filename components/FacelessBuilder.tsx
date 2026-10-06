"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Mic } from "lucide-react";

type Scene = { line: string; query: string; media: HTMLImageElement | null; credit: string };
type StockInfo = { url: string; thumburl?: string; size?: number; descriptionurl?: string };
const STOP = new Set("the a an and or to for of in on your is it not then with this that from just does have will".split(" "));
const VISUAL: [RegExp, string][] = [
  [/sleep|night|bed|rest/, "person sleeping in bed"],
  [/walk|steps|stroll/, "person walking park path"],
  [/food|eat|meal|diet|plate/, "healthy meal plate"],
  [/lift|gym|muscle|weight/, "person lifting weights"],
  [/pill|supplement|drug/, "empty medicine bottle"],
  [/clock|year|age|time/, "clock on a wall"],
  [/city|street/, "city street daylight"],
  [/run|jog/, "person jogging park"],
];

function spokenLines(script: string) {
  return script.split(/\n+/).map((s) => s.replace(/^#+\s*/, "").replace(/^\d+[.)]\s*/, "").trim()).filter((s) => {
    if (s.length < 8) return false;
    if (/^(hook|cta|visual|b-roll|on-screen|scene|caption)\b/i.test(s)) return false;
    if (/\d+:\d+/.test(s) && s.length < 40) return false;
    if (/on-screen text|bold on cards|1-2 lines/i.test(s)) return false;
    return true;
  }).slice(0, 12);
}
function visualQuery(line: string) {
  for (const [re, q] of VISUAL) if (re.test(line.toLowerCase())) return q + " filemime:image/jpeg";
  const words = line.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
  return (words.slice(0, 2).join(" ") || "daylight landscape") + " photograph filemime:image/jpeg";
}
function secondsFor(line: string) {
  return Math.min(12, Math.max(4.5, line.split(/\s+/).length / 2.2));
}
async function commons(q: string): Promise<StockInfo[]> {
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=4&prop=imageinfo&iiprop=url&iiurlwidth=1080&gsrsearch=" + encodeURIComponent(q);
  const data = await fetch(url).then((r) => r.json());
  const pages = Object.values(data.query?.pages || {}) as { imageinfo?: StockInfo[] }[];
  return pages.map((p) => p.imageinfo?.[0]).filter((info): info is StockInfo => Boolean(info));
}
function loadImage(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url.split("?")[0];
  });
}
function cover(ctx: CanvasRenderingContext2D, media: CanvasImageSource, w: number, h: number, dx: number, dy: number, dw: number, dh: number, zoom: number) {
  const scale = Math.max(dw / (w * zoom), dh / (h * zoom));
  const nw = w * zoom * scale;
  const nh = h * zoom * scale;
  ctx.drawImage(media, dx + (dw - nw) / 2, dy + (dh - nh) / 2, nw, nh);
}
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(" ");
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const trial = line ? line + " " + word : word;
    if (ctx.measureText(trial).width > max && line) { out.push(line); line = word; }
    else line = trial;
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}

export function FacelessBuilder({ script, title, contentId }: { script: string; title: string; contentId?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scenesRef = useRef<Scene[]>([]);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const [text, setText] = useState(script);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [status, setStatus] = useState("Spoken lines only. Stage directions are ignored.");
  const [fileUrl, setFileUrl] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(script), [script]);

  function paint(elapsed: number, list = scenesRef.current) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cards = list.length ? list : spokenLines(text).map((line) => ({ line, query: visualQuery(line), media: null, credit: "" }));
    let cursor = 0;
    let idx = 0;
    let local = 0;
    for (let i = 0; i < cards.length; i++) {
      const len = secondsFor(cards[i].line);
      if (elapsed < cursor + len || i === cards.length - 1) { idx = i; local = Math.min(1, (elapsed - cursor) / len); break; }
      cursor += len;
    }
    const scene = cards[idx] || { line: title || "Faceless", media: null };
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, 720, 1280);
    if (scene.media) cover(ctx, scene.media, scene.media.naturalWidth || 720, scene.media.naturalHeight || 800, 0, 120, 720, 820, 1 + local * 0.05);
    else { ctx.fillStyle = "#1e5c49"; ctx.fillRect(0, 120, 720, 820); }
    ctx.fillStyle = "rgba(12,11,9,0.84)";
    ctx.fillRect(0, 960, 720, 320);
    ctx.fillStyle = "#f4eee4";
    ctx.font = "700 42px Georgia, serif";
    wrap(ctx, scene.line, 610).forEach((ln, i) => ctx.fillText(ln, 48, 1040 + i * 52));
    ctx.fillStyle = "#e23d12";
    ctx.fillRect(48, 1236, 624 * Math.min(1, local || 0.05), 8);
  }

  async function findStock() {
    setBusy(true);
    const lines = spokenLines(text);
    setStatus("Matching photos to " + lines.length + " spoken lines…");
    const built: Scene[] = [];
    for (const line of lines) {
      const query = visualQuery(line);
      const pics = await commons(query).catch(() => [] as StockInfo[]);
      let media: HTMLImageElement | null = null;
      let credit = "Wikimedia Commons";
      for (const pic of pics) {
        media = await loadImage(pic.thumburl || pic.url);
        if (media) { credit = pic.descriptionurl || credit; break; }
      }
      built.push({ line, query, media, credit });
    }
    scenesRef.current = built;
    setScenes(built);
    paint(0.2, built);
    const total = built.reduce((n, s) => n + secondsFor(s.line), 0);
    setStatus(built.filter((s) => s.media).length + " photos. About " + Math.round(total) + " seconds. Add a voice file to put it in the export.");
    setBusy(false);
    return built;
  }

  function speak() {
    const lines = spokenLines(text);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(lines.join(". "));
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
    setStatus("Playing voice in the browser. A downloaded file includes voice only if you attach an audio file.");
  }

  async function render() {
    if (busy) return;
    const list = scenesRef.current.length ? scenesRef.current : await findStock();
    const canvas = canvasRef.current;
    if (!canvas || !list.length) return;
    paint(0.05, list);
    const canvasStream = canvas.captureStream(30);
    let mixed: MediaStream = canvasStream;
    const voice = voiceRef.current;
    if (voice && voice.src) {
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      const source = audioCtx.createMediaElementSource(voice);
      source.connect(dest);
      source.connect(audioCtx.destination);
      mixed = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      voice.currentTime = 0;
      await voice.play();
    }
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const rec = new MediaRecorder(mixed, { mimeType: mime });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { rec.onstop = resolve; });
    setStatus("Rendering…");
    rec.start();
    const total = list.reduce((n, s) => n + secondsFor(s.line), 0);
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const id = window.setInterval(() => {
        const t = (performance.now() - started) / 1000;
        paint(t, list);
        if (t >= total) { window.clearInterval(id); resolve(); }
      }, 40);
    });
    rec.stop();
    voice?.pause();
    await done;
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    setFileUrl(url);
    const a = document.createElement("a");
    a.href = url;
    a.download = (title || "faceless").slice(0, 40).replace(/\s+/g, "-") + ".webm";
    a.click();
    if (contentId) {
      const req = indexedDB.open("faceless-builder", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("cuts");
      req.onsuccess = () => req.result.transaction("cuts", "readwrite").objectStore("cuts").put(blob, String(contentId));
    }
    setStatus("Downloaded. Captions are the spoken lines. Voice is in the file if you attached one.");
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <canvas ref={canvasRef} width={720} height={1280} className="w-full max-w-[220px] rounded-2xl bg-black" />
      <div>
        <textarea value={text} onChange={(e) => { setText(e.target.value); scenesRef.current = []; }} className="cai-input min-h-[140px] text-sm" />
        <label className="mt-3 flex items-center gap-2 text-xs text-dark-300">
          <Mic size={12} /> Voice file
          <input type="file" accept="audio/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!voiceRef.current) voiceRef.current = new Audio();
            voiceRef.current.src = URL.createObjectURL(file);
            setVoiceName(file.name);
          }} />
          {voiceName}
        </label>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={findStock} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1"><ImageIcon size={12} /> Find stock</button>
          <button onClick={speak} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1"><Mic size={12} /> Play voice</button>
          <button onClick={render} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-brand-500/15 text-brand-400 flex items-center gap-1"><Download size={12} /> Make video</button>
        </div>
        <p className="text-xs text-dark-500 mt-3">{status}</p>
        {scenes.map((s, i) => <p key={i} className="text-[10px] text-dark-500 truncate">{i + 1}. {s.line}</p>)}
        {fileUrl ? <video src={fileUrl} controls className="mt-3 w-full max-w-[220px] rounded-xl" /> : null}
      </div>
    </div>
  );
}

export function FacelessCut(props: { script: string; title: string; contentId?: number }) {
  return <FacelessBuilder {...props} />;
}
