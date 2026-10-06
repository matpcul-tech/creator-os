"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Mic } from "lucide-react";

type Scene = { caption: string; voice: string; visual: string; media: HTMLImageElement | null; credit: string; seconds: number };
type StockInfo = { url: string; thumburl?: string; size?: number; descriptionurl?: string };

function clean(value: string) {
  return value.replace(/^#+\s*/, "").replace(/^>\s*/, "").replace(/^[*_]+|[*_]+$/g, "").replace(/^["\u201c]|["\u201d]$/g, "").trim();
}
function parseScript(script: string): Scene[] {
  const chunks = script.split(/\n---\n|\n##+\s+/).map((c) => c.trim()).filter(Boolean);
  const scenes: Scene[] = [];
  for (const chunk of chunks) {
    const on = chunk.match(/\*\*ON-SCREEN TEXT:\*\*([\s\S]*?)(\*\*VOICEOVER:\*\*|\*\*B-ROLL:\*\*|$)/i);
    const voice = chunk.match(/\*\*VOICEOVER:\*\*([\s\S]*?)(\*\*ON-SCREEN TEXT:\*\*|\*\*B-ROLL:\*\*|$)/i);
    const roll = chunk.match(/\*\*B-ROLL:\*\*([\s\S]*?)(\*\*ON-SCREEN TEXT:\*\*|\*\*VOICEOVER:\*\*|$)/i);
    const captions = (on?.[1] || "").split(/\n+/).map(clean).filter((line) => line.length > 1 && !/^on-screen/i.test(line));
    const spoken = clean((voice?.[1] || "").replace(/\n+/g, " "));
    const visual = clean((roll?.[1] || "").split(/[.,]/)[0] || "");
    if (!captions.length && !spoken) continue;
    const lines = captions.length ? captions : [spoken];
    const seconds = Math.max(4, spoken.split(/\s+/).filter(Boolean).length / 2.3);
    lines.forEach((caption) => scenes.push({ caption, voice: spoken, visual: visual || caption, media: null, credit: "", seconds: seconds / lines.length }));
  }
  return scenes.slice(0, 24);
}
async function commons(q: string): Promise<StockInfo[]> {
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url&iiurlwidth=1080&gsrsearch=" + encodeURIComponent(q + " filemime:image/jpeg");
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
function cover(ctx: CanvasRenderingContext2D, media: CanvasImageSource, w: number, h: number, dx: number, dy: number, dw: number, dh: number) {
  const scale = Math.max(dw / w, dh / h);
  const nw = w * scale;
  const nh = h * scale;
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
  return out.slice(0, 4);
}

export function FacelessBuilder({ script, title, contentId }: { script: string; title: string; contentId?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scenesRef = useRef<Scene[]>([]);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const [text, setText] = useState(script);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [status, setStatus] = useState("Reader uses voiceover, on-screen text, and B-roll. Headings are ignored.");
  const [fileUrl, setFileUrl] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(script), [script]);

  function read() {
    const parsed = parseScript(text);
    scenesRef.current = parsed;
    setScenes(parsed);
    const total = parsed.reduce((n, s) => n + s.seconds, 0);
    setStatus(parsed.length + " cards from on-screen text. About " + Math.round(total) + " seconds from the voiceover.");
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
    if (scene?.media) cover(ctx, scene.media, scene.media.naturalWidth || 720, scene.media.naturalHeight || 800, 0, 100, 720, 840);
    else { ctx.fillStyle = "#1c1b19"; ctx.fillRect(0, 100, 720, 840); }
    ctx.fillStyle = "rgba(12,11,9,0.86)";
    ctx.fillRect(0, 960, 720, 320);
    ctx.fillStyle = "#f4eee4";
    ctx.font = "700 40px Georgia, serif";
    wrap(ctx, scene?.caption || title || "Faceless", 610).forEach((ln, i) => ctx.fillText(ln, 48, 1036 + i * 50));
  }
  async function findStock() {
    setBusy(true);
    const parsed = read();
    const built: Scene[] = [];
    for (const scene of parsed) {
      const pics = await commons(scene.visual).catch(() => [] as StockInfo[]);
      let media: HTMLImageElement | null = null;
      let credit = "Wikimedia Commons";
      for (const pic of pics) {
        media = await loadImage(pic.thumburl || pic.url);
        if (media) { credit = pic.descriptionurl || credit; break; }
      }
      built.push({ ...scene, media, credit });
    }
    scenesRef.current = built;
    setScenes(built);
    paint(0.2, built);
    setBusy(false);
    setStatus("Stock matched from B-roll notes, not from the headings.");
    return built;
  }
  function speak() {
    const parsed = scenesRef.current.length ? scenesRef.current : read();
    const spoken = Array.from(new Set(parsed.map((s) => s.voice).filter(Boolean))).join(" ");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
    setStatus("Playing the voiceover only. Headings and B-roll are not spoken.");
  }
  async function render() {
    if (busy) return;
    const list = scenesRef.current.length ? scenesRef.current : await findStock();
    const canvas = canvasRef.current;
    if (!canvas || !list.length) return;
    const canvasStream = canvas.captureStream(30);
    let mixed: MediaStream = canvasStream;
    const voice = voiceRef.current;
    if (voice?.src) {
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
    a.download = (title || "faceless").slice(0, 40).replace(/\s+/g, "-") + ".webm";
    a.click();
    if (contentId) {
      const req = indexedDB.open("faceless-builder", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("cuts");
      req.onsuccess = () => req.result.transaction("cuts", "readwrite").objectStore("cuts").put(blob, String(contentId));
    }
    setStatus("Downloaded. Captions are the on-screen lines. Voice file is mixed if you attached one.");
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <canvas ref={canvasRef} width={720} height={1280} className="w-full max-w-[220px] rounded-2xl bg-black" />
      <div>
        <textarea value={text} onChange={(e) => { setText(e.target.value); scenesRef.current = []; }} className="cai-input min-h-[160px] text-sm" />
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
          <button onClick={read} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white">Read script</button>
          <button onClick={findStock} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1"><ImageIcon size={12} /> Find stock</button>
          <button onClick={speak} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1"><Mic size={12} /> Play voiceover</button>
          <button onClick={render} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-brand-500/15 text-brand-400 flex items-center gap-1"><Download size={12} /> Make video</button>
        </div>
        <p className="text-xs text-dark-500 mt-3">{status}</p>
        {scenes.slice(0, 8).map((s, i) => <p key={i} className="text-[10px] text-dark-500 truncate">{i + 1}. {s.caption} — {s.visual}</p>)}
        {fileUrl ? <video src={fileUrl} controls className="mt-3 w-full max-w-[220px] rounded-xl" /> : null}
      </div>
    </div>
  );
}

export function FacelessCut(props: { script: string; title: string; contentId?: number }) {
  return <FacelessBuilder {...props} />;
}
