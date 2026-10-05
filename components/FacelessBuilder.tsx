"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Play, Square } from "lucide-react";

type Card = { kicker: string; text: string };

function toCards(script: string, title: string): Card[] {
  const lines = script.split(/\n+/).map((line) => line.replace(/^[#>*\-\d.\s]+/, "").trim()).filter((line) => line.length > 2);
  const source = lines.length ? lines : [title || "Untitled short"];
  return source.slice(0, 8).map((text, i) => ({
    kicker: i === 0 ? "HOOK" : i === source.length - 1 ? "CTA" : String(i).padStart(2, "0"),
    text: text.length > 140 ? text.slice(0, 137) + "\u2026" : text,
  }));
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > max && line) { lines.push(line); line = word; }
    else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

function paint(canvas: HTMLCanvasElement, card: Card, index: number, total: number, progress: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, 720, 1280);
  ctx.fillStyle = "#12110f";
  ctx.fillRect(0, 0, 720, 1280);
  ctx.fillStyle = "#f3ecdf";
  ctx.beginPath();
  ctx.roundRect(36, 48, 648, 1184, 28);
  ctx.fill();
  ctx.fillStyle = index % 2 ? "#1e5c49" : "#e23d12";
  ctx.fillRect(36, 48, 648 * progress, 10);
  ctx.font = "600 26px sans-serif";
  ctx.fillText(card.kicker, 72, 150);
  ctx.fillStyle = "#141310";
  ctx.font = "700 52px Georgia, serif";
  wrap(ctx, card.text, 560).forEach((line, i) => ctx.fillText(line, 72, 270 + i * 66));
  ctx.fillStyle = "#6e665c";
  ctx.font = "500 22px sans-serif";
  ctx.fillText("FACELESS", 72, 1148);
  ctx.fillText(`${index + 1} / ${total}`, 540, 1148);
}

function saveLocal(key: string, blob: Blob) {
  const req = indexedDB.open("faceless-builder", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("cuts");
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction("cuts", "readwrite");
    tx.objectStore("cuts").put(blob, key);
  };
}

export function FacelessBuilder({ script, title, contentId }: { script: string; title: string; contentId?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lines, setLines] = useState(script);
  const [status, setStatus] = useState("Free render. No face, no API key.");
  const [fileUrl, setFileUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const cards = toCards(lines, title);

  useEffect(() => setLines(script), [script]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && cards[0]) paint(canvas, cards[0], 0, cards.length, 0.15);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [lines, title]);

  function stop() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  }

  function run(record: boolean) {
    const canvas = canvasRef.current;
    if (!canvas || !cards.length) return;
    stop();
    setPlaying(true);
    let rec: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    if (record) {
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime });
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.start();
      setStatus("Making the faceless file…");
    }
    const started = performance.now();
    timer.current = window.setInterval(() => {
      const t = (performance.now() - started) / 1000;
      const idx = Math.min(cards.length - 1, Math.floor(t / 3.2));
      paint(canvas, cards[idx], idx, cards.length, (t - idx * 3.2) / 3.2);
      if (t >= cards.length * 3.2) {
        stop();
        if (rec) {
          rec.onstop = () => {
            const blob = new Blob(chunks, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            setFileUrl(url);
            saveLocal(String(contentId || title || "latest"), blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${(title || "faceless-short").slice(0, 40).replace(/\s+/g, "-")}.webm`;
            a.click();
            setStatus("Added. The file downloaded and is kept in this browser for this piece.");
          };
          rec.stop();
        }
      }
    }, 33);
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6 items-start">
      <canvas ref={canvasRef} width={720} height={1280} className="w-full max-w-[220px] rounded-2xl bg-[#f3ecdf]" />
      <div>
        <label className="text-xs uppercase tracking-wider text-dark-500">Cards, one line each</label>
        <textarea value={lines} onChange={(e) => setLines(e.target.value)} className="cai-input min-h-[140px] text-sm mt-1" />
        <p className="text-sm text-dark-300 my-3">Faceless only. {cards.length} cards. Render is free in this browser.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => run(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800/40 text-white flex items-center gap-1">{playing ? <Square size={12} /> : <Play size={12} />} Preview</button>
          <button onClick={() => run(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/15 text-brand-400 flex items-center gap-1"><Download size={12} /> Make video and add it</button>
        </div>
        <p className="text-xs text-dark-500 mt-3">{status}</p>
        {fileUrl ? <video src={fileUrl} controls className="mt-3 w-full max-w-[220px] rounded-xl" /> : null}
      </div>
    </div>
  );
}

export function FacelessCut(props: { script: string; title: string; contentId?: number }) {
  return <FacelessBuilder {...props} />;
}
