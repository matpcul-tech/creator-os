"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Play } from "lucide-react";

type Scene = { line: string; media: HTMLImageElement | HTMLVideoElement | null; credit: string };
type StockInfo = { url: string; thumburl?: string; size?: number; descriptionurl?: string };
const STOP = new Set("the a an and or to for of in on your is it not then with this that from just".split(" "));

function linesOf(script: string) {
  return script.split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
}
function queryFor(line: string) {
  const words = line.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
  return (words.slice(0, 3).join(" ") || "city street") + " filemime:image/jpeg";
}
async function commons(q: string): Promise<StockInfo[]> {
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=4&prop=imageinfo&iiprop=url|size&iiurlwidth=1080&gsrsearch=" + encodeURIComponent(q);
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
  const sw = w * zoom;
  const sh = h * zoom;
  const scale = Math.max(dw / sw, dh / sh);
  const nw = sw * scale;
  const nh = sh * scale;
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
  const [text, setText] = useState(script);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [status, setStatus] = useState("Stock under the caption. Free Commons photos. No face.");
  const [fileUrl, setFileUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(script), [script]);

  function paint(progress: number, list = scenesRef.current) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cards = list.length ? list : linesOf(text).map((line) => ({ line, media: null, credit: "" }));
    const idx = Math.min(cards.length - 1, Math.max(0, Math.floor(progress)));
    const local = progress - Math.floor(progress);
    const scene = cards[idx] || { line: title || "Faceless", media: null, credit: "" };
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, 720, 1280);
    if (scene.media && scene.media.tagName === "IMG") {
      cover(ctx, scene.media, scene.media.naturalWidth || 720, scene.media.naturalHeight || 760, 0, 140, 720, 800, 1 + local * 0.06);
    } else {
      ctx.fillStyle = idx % 2 ? "#1e5c49" : "#e23d12";
      ctx.fillRect(0, 140, 720, 800);
    }
    ctx.fillStyle = "rgba(12,11,9,0.82)";
    ctx.fillRect(0, 960, 720, 320);
    ctx.fillStyle = "#e23d12";
    ctx.font = "600 22px sans-serif";
    ctx.fillText(idx === 0 ? "HOOK" : idx === cards.length - 1 ? "CTA" : String(idx).padStart(2, "0"), 48, 1016);
    ctx.fillStyle = "#f4eee4";
    ctx.font = "700 40px Georgia, serif";
    wrap(ctx, scene.line, 600).forEach((ln, i) => ctx.fillText(ln, 48, 1068 + i * 50));
    ctx.fillStyle = "#e23d12";
    ctx.fillRect(48, 1236, 624 * Math.min(1, local || 0.05), 8);
  }

  async function findStock() {
    setBusy(true);
    setStatus("Matching a photo to each line…");
    const built: Scene[] = [];
    for (const line of linesOf(text)) {
      const pics = await commons(queryFor(line)).catch(() => [] as StockInfo[]);
      let media: HTMLImageElement | null = null;
      let credit = "Wikimedia Commons";
      for (const pic of pics) {
        media = await loadImage(pic.thumburl || pic.url);
        if (media) { credit = pic.descriptionurl || credit; break; }
      }
      built.push({ line, media, credit });
    }
    scenesRef.current = built;
    setScenes(built);
    paint(0.15, built);
    const hit = built.filter((s) => s.media).length;
    setStatus(hit + " of " + built.length + " scenes have stock. Credit the Commons files when you post.");
    setBusy(false);
    return built;
  }

  async function render() {
    if (busy) return;
    const list = scenesRef.current.length ? scenesRef.current : await findStock();
    const canvas = canvasRef.current;
    if (!canvas || !list.length) return;
    paint(0.05, list);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { rec.onstop = resolve; });
    setStatus("Rendering the stock cut…");
    rec.start();
    const total = list.length * 3.2;
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const id = window.setInterval(() => {
        const t = (performance.now() - started) / 1000;
        paint(t / 3.2, list);
        if (t >= total) { window.clearInterval(id); resolve(); }
      }, 40);
    });
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type: "video/webm" });
    if (blob.size < 1000) {
      setStatus("Render came back empty. Hit Find stock, then Make video again.");
      return;
    }
    const url = URL.createObjectURL(blob);
    setFileUrl(url);
    const a = document.createElement("a");
    a.href = url;
    a.download = (title || "faceless-stock").slice(0, 40).replace(/\s+/g, "-") + ".webm";
    a.click();
    if (contentId) {
      const req = indexedDB.open("faceless-builder", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("cuts");
      req.onsuccess = () => req.result.transaction("cuts", "readwrite").objectStore("cuts").put(blob, String(contentId));
    }
    setStatus("File downloaded. Stock is in the picture. Upload it from Publish.");
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <canvas ref={canvasRef} width={720} height={1280} className="w-full max-w-[220px] rounded-2xl bg-black" />
      <div>
        <textarea value={text} onChange={(e) => { setText(e.target.value); scenesRef.current = []; }} className="cai-input min-h-[140px] text-sm" />
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={findStock} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1"><ImageIcon size={12} /> Find stock</button>
          <button onClick={() => paint(0.2)} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1"><Play size={12} /> Preview</button>
          <button onClick={render} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-brand-500/15 text-brand-400 flex items-center gap-1"><Download size={12} /> Make stock video</button>
        </div>
        <p className="text-xs text-dark-500 mt-3">{status}</p>
        {scenes.filter((s) => s.credit).map((s, i) => <p key={i} className="text-[10px] text-dark-500 truncate">{i + 1}. {s.credit}</p>)}
        {fileUrl ? <video src={fileUrl} controls className="mt-3 w-full max-w-[220px] rounded-xl" /> : null}
      </div>
    </div>
  );
}

export function FacelessCut(props: { script: string; title: string; contentId?: number }) {
  return <FacelessBuilder {...props} />;
}
