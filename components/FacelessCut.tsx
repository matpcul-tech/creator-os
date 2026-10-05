"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Play, Square } from "lucide-react";

type Card = { kicker: string; text: string };

function toCards(script: string, title: string): Card[] {
  const lines = script
    .split(/\n+/)
    .map((line) => line.replace(/^[#>*\-\d.\s]+/, "").trim())
    .filter((line) => line.length > 8 && !line.endsWith(":"));
  const source = lines.length ? lines : [title || script];
  const cards = source.slice(0, 8).map((text, i) => ({
    kicker: i === 0 ? "HOOK" : i === source.length - 1 ? "CTA" : String(i).padStart(2, "0"),
    text: text.length > 140 ? text.slice(0, 137) + "…" : text,
  }));
  return cards.length ? cards : [{ kicker: "HOOK", text: title || "Untitled short" }];
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function paint(
  canvas: HTMLCanvasElement,
  card: Card,
  index: number,
  total: number,
  progress: number,
) {
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
  ctx.font = "700 54px Georgia, serif";
  const lines = wrap(ctx, card.text, 560);
  lines.forEach((line, i) => ctx.fillText(line, 72, 280 + i * 68));
  ctx.fillStyle = "#6e665c";
  ctx.font = "500 22px sans-serif";
  ctx.fillText("FACELESS", 72, 1148);
  ctx.fillText(`${index + 1} / ${total}`, 560, 1148);
}

export function FacelessCut({ script, title }: { script: string; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("No face. Captions only.");
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  const cards = toCards(script, title);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) paint(canvas, cards[0], 0, cards.length, 0.15);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [script, title]);

  function stop() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  }

  function play() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    stop();
    setPlaying(true);
    const started = performance.now();
    timer.current = window.setInterval(() => {
      const t = (performance.now() - started) / 1000;
      const each = 3.2;
      const idx = Math.min(cards.length - 1, Math.floor(t / each));
      paint(canvas, cards[idx], idx, cards.length, (t - idx * each) / each);
      if (t >= cards.length * each) stop();
    }, 33);
  }

  async function render() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    stop();
    const stream = canvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise((resolve) => {
      rec.onstop = resolve;
    });
    setStatus("Rendering faceless cut…");
    rec.start();
    const started = performance.now();
    const total = cards.length * 3.2;
    await new Promise<void>((resolve) => {
      const id = window.setInterval(() => {
        const t = (performance.now() - started) / 1000;
        const idx = Math.min(cards.length - 1, Math.floor(t / 3.2));
        paint(canvas, cards[idx], idx, cards.length, (t - idx * 3.2) / 3.2);
        if (t >= total) {
          window.clearInterval(id);
          resolve();
        }
      }, 33);
    });
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(title || "faceless-short").slice(0, 40).replace(/\s+/g, "-")}.webm`;
    a.click();
    setStatus("Downloaded. No face in the file. Upload it from Publish.");
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6 items-start">
      <canvas
        ref={canvasRef}
        width={720}
        height={1280}
        className="w-full max-w-[220px] rounded-2xl bg-[#f3ecdf]"
      />
      <div>
        <p className="text-sm text-dark-300 mb-3">
          Faceless only. The cut is type on a card — no avatar, no cloned face,
          no HeyGen. {cards.length} cards from this script.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={play}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800/40 text-white flex items-center gap-1"
          >
            {playing ? <Square size={12} /> : <Play size={12} />}
            {playing ? "Playing" : "Preview"}
          </button>
          <button
            onClick={render}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/15 text-brand-400 flex items-center gap-1"
          >
            <Download size={12} /> Render faceless video
          </button>
        </div>
        <p className="text-xs text-dark-500 mt-3">{status}</p>
      </div>
    </div>
  );
}
