"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Play } from "lucide-react";

type Scene = { line: string; media: CanvasImageSource | null; credit: string };
const STOP = new Set("the a an and or to for of in on your is it not then with this that from just".split(" "));

function linesOf(script: string) {
  return script.split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
}
function queryFor(line: string) {
  const words = line.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
  return (words.slice(0, 3).join(" ") || "city street") + " filemime:image/jpeg";
}
async function commons(q: string, video: boolean) {
  const search = video ? q.replace("filemime:image/jpeg", "filemime:video/webm") : q;
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=4&prop=imageinfo&iiprop=url|size&iiurlwidth=1080&gsrsearch=" + encodeURIComponent(search);
  const data = await fetch(url).then((r) => r.json());
  return Object.values(data.query?.pages || {}).map((p) => (p as { imageinfo?: { url: string; thumburl?: string; size?: number; descriptionurl?: string }[] }).imageinfo?.[0]).filter(Boolean).filter((info) => !video || (info.size || 0) < 12000000);
}
function loadImage(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
function loadVideo(url: string) {
  return new Promise<HTMLVideoElement | null>((resolve) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    const done = (ok: boolean) => resolve(ok ? v : null);
    v.onloadeddata = () => done(true);
    v.onerror = () => done(false);
    window.setTimeout(() => done(v.readyState >= 2), 5000);
    v.src = url;
  });
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
  const [text, setText] = useState(script);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [status, setStatus] = useState("Stock under the caption. Free Commons footage. No face.");
  const [fileUrl, setFileUrl] = useState("");
  useEffect(() => setText(script), [script]);

  function paint(progress: number, list = scenes) {
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
    const media = scene.media as HTMLVideoElement | HTMLImageElement | null;
    if (media && (media as HTMLVideoElement).tagName === "VIDEO") {
      const v = media as HTMLVideoElement;
      try { v.currentTime = Math.min(v.duration || 2, local * 2.4); ctx.drawImage(v, 0, 160, 720, 760); } catch { /* frame not ready */ }
    } else if (media) {
      const zoom = 1 + local * 0.08;
      const w = 720 * zoom;
      const h = 760 * zoom;
      ctx.drawImage(media, (720 - w) / 2, 160 + (760 - h) / 2, w, h);
    } else {
      ctx.fillStyle = idx % 2 ? "#1e5c49" : "#e23d12";
      ctx.fillRect(0, 160, 720, 760);
    }
    ctx.fillStyle = "rgba(12,11,9,0.8)";
    ctx.fillRect(28, 960, 664, 250);
    ctx.fillStyle = "#f4eee4";
    ctx.font = "700 40px Georgia, serif";
    wrap(ctx, scene.line, 600).forEach((ln, i) => ctx.fillText(ln, 52, 1024 + i * 50));
    ctx.fillStyle = "#e23d12";
    ctx.fillRect(28, 1230, 664 * (local || 0.05), 8);
  }

  async function findStock() {
    setStatus("Pulling free stock clips and photos…");
    const built: Scene[] = [];
    for (const line of linesOf(text)) {
      const q = queryFor(line);
      let media: CanvasImageSource | null = null;
      let credit = "Wikimedia Commons";
      const vids = await commons(q, true).catch(() => []);
      if (vids[0]) {
        media = await loadVideo(vids[0].thumburl || vids[0].url);
        credit = vids[0].descriptionurl || credit;
      }
      if (!media) {
        const pics = await commons(q, false).catch(() => []);
        if (pics[0]) {
          media = await loadImage(pics[0].thumburl || pics[0].url);
          credit = pics[0].descriptionurl || credit;
        }
      }
      built.push({ line, media, credit });
    }
    setScenes(built);
    paint(0.1, built);
    setStatus(built.filter((s) => s.media).length + " of " + built.length + " scenes have stock. Credit the Commons files when you post.");
  }

  async function render() {
    if (!scenes.length) await findStock();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { rec.onstop = resolve; });
    rec.start();
    const total = Math.max(linesOf(text).length, 1) * 3.2;
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const id = window.setInterval(() => {
        const t = (performance.now() - started) / 1000;
        paint(t / 3.2);
        if (t >= total) { window.clearInterval(id); resolve(); }
      }, 40);
    });
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type: "video/webm" });
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
    setStatus("Stock cut added. Upload this file from Publish.");
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <canvas ref={canvasRef} width={720} height={1280} className="w-full max-w-[220px] rounded-2xl bg-black" />
      <div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} className="cai-input min-h-[140px] text-sm" />
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={findStock} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1"><ImageIcon size={12} /> Find stock</button>
          <button onClick={() => paint(0.2)} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1"><Play size={12} /> Preview</button>
          <button onClick={render} className="px-3 py-1.5 rounded-lg text-xs bg-brand-500/15 text-brand-400 flex items-center gap-1"><Download size={12} /> Make stock video</button>
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
