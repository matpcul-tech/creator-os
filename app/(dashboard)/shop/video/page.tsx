"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clapperboard, Upload, Wand2, Download, Copy, AlertTriangle, Hand } from "lucide-react";
import type { Product } from "@/lib/shop/products";
import { loadHooks, loadPicks, rememberHook } from "@/lib/shop/store";
import { DISCLOSURE, MAX_SECONDS, cleanName, finalize, noDashes, postCaption, segmentTimes, spokenSegments, spokenSeconds, templateScript, type ShopScript } from "@/lib/shop/video";
import { voiceTrack } from "@/lib/cut/voice-track";
import { VOICES } from "@/lib/cut/types";

type Media = { id: string; url: string; kind: "video" | "image"; name: string; real: boolean; el?: HTMLVideoElement | HTMLImageElement };

const W = 1080;
const H = 1920;

function pickMime(): { mime: string; ext: string } {
  const options = [
    { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
    { mime: "video/mp4;codecs=avc1,mp4a", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  return options.find((o) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(o.mime)) ?? { mime: "", ext: "webm" };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawCover(ctx: CanvasRenderingContext2D, el: HTMLVideoElement | HTMLImageElement, zoom: number) {
  const sw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
  const sh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  if (!sw || !sh) return;
  const scale = Math.max(W / sw, H / sh) * zoom;
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function textBlock(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, bg: string) {
  ctx.font = `700 ${size}px Figtree, Arial, sans-serif`;
  const lines = wrap(ctx, text, W - 160);
  const lh = size * 1.2;
  const h = lines.length * lh + 40;
  ctx.fillStyle = bg;
  const top = y - h / 2;
  ctx.beginPath();
  ctx.roundRect(60, top, W - 120, h, 28);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + 20 + lh / 2 + i * lh));
}

function VideoMaker() {
  const params = useSearchParams();
  const [picks, setPicks] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [benefits, setBenefits] = useState("");
  const [script, setScript] = useState<ShopScript | null>(null);
  const [scriptSource, setScriptSource] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [voiceMode, setVoiceMode] = useState<"ai" | "own">("ai");
  const [voiceId, setVoiceId] = useState("ara");
  const [clipSound, setClipSound] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; ext: string; seconds: number; aiVoice: boolean; h264: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const list = loadPicks();
    setPicks(list);
    const want = params.get("product");
    const p = list.find((x) => x.id === want) ?? null;
    if (p) choose(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(p: Product | null) {
    setProductId(p?.id ?? "");
    if (!p) return;
    setName(cleanName(p.name));
    setPrice(p.price ? String(p.price) : "");
    setCategory(p.category === "Uncategorized" ? "" : p.category);
    setScript(null);
  }

  async function generate() {
    setError("");
    setBusy("Writing hook, script, and caption");
    const input = { name, category, price: Number(price) || undefined, benefits };
    try {
      const res = await fetch("/api/ai/shop-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, avoid: loadHooks() }),
      });
      const data = (await res.json()) as { script?: ShopScript; source?: string; error?: string };
      if (!data.script) throw new Error(data.error || "No script");
      setScript(data.script);
      setScriptSource(data.source === "ai" ? "Written by AI. Edit anything below." : "AI is unavailable, so this is a template. Edit it to match what you show.");
    } catch {
      setScript(templateScript(input));
      setScriptSource("AI is unavailable, so this is a template. Edit it to match what you show.");
    }
    setBusy("");
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Media[] = Array.from(files)
      .filter((f) => f.type.startsWith("video/") || f.type.startsWith("image/"))
      .map((f) => ({ id: `${f.name}-${f.size}-${Math.random()}`, url: URL.createObjectURL(f), kind: f.type.startsWith("video/") ? "video" : "image", name: f.name, real: f.type.startsWith("video/") }));
    setMedia((m) => [...m, ...next]);
  }

  const hasReal = media.some((m) => m.real && m.kind === "video");
  const estSeconds = script ? Math.min(MAX_SECONDS, spokenSeconds(script)) : 0;

  async function loadEl(m: Media): Promise<HTMLVideoElement | HTMLImageElement> {
    if (m.kind === "image") {
      const img = new Image();
      img.src = m.url;
      await img.decode();
      return img;
    }
    const v = document.createElement("video");
    v.src = m.url;
    v.muted = !clipSound;
    v.playsInline = true;
    v.loop = true;
    v.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error(`Could not read ${m.name}`)); });
    return v;
  }

  async function render() {
    if (!script || !canvasRef.current) return;
    setError("");
    setResult(null);
    const segs = spokenSegments(script);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const audio = new AudioContext();
    const dest = audio.createMediaStreamDestination();
    try {
      setBusy("Loading your clips");
      const els = await Promise.all(media.map(loadEl));
      let total = Math.min(MAX_SECONDS, spokenSeconds(script));
      let times = segmentTimes(segs, total);
      let voiceBuffer: AudioBuffer | null = null;
      if (voiceMode === "ai") {
        setBusy("Recording the voiceover");
        const track = await voiceTrack({ segments: segs, voiceId, context: audio, unit: "line" });
        if (!track.ok) throw new Error(track.error);
        voiceBuffer = track.buffer;
        total = Math.min(MAX_SECONDS, track.total + 0.6);
        times = track.spans.map((s) => ({ start: s.start, end: s.end }));
      }
      if (clipSound) {
        const gain = audio.createGain();
        gain.gain.value = voiceMode === "ai" ? 0.25 : 1;
        gain.connect(dest);
        els.forEach((el) => { if (el instanceof HTMLVideoElement) audio.createMediaElementSource(el).connect(gain); });
      }
      // Media order: real hand-held clips lead, then the rest. Each spoken line shows one item.
      const order = els.map((el, i) => ({ el, m: media[i] })).sort((a, b) => Number(b.m.real) - Number(a.m.real));
      const shotFor = (i: number) => order[i % order.length];

      setBusy("Rendering the video");
      const { mime, ext } = pickMime();
      const stream = canvas.captureStream(30);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise<Blob>((res) => { rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || mime || "video/webm" })); });

      let voiceNode: AudioBufferSourceNode | null = null;
      if (voiceBuffer) {
        voiceNode = audio.createBufferSource();
        voiceNode.buffer = voiceBuffer;
        voiceNode.connect(dest);
      }
      await audio.resume();
      rec.start(500);
      const t0 = audio.currentTime;
      voiceNode?.start();
      let current = -1;
      await new Promise<void>((resolve) => {
        const frame = () => {
          const t = audio.currentTime - t0;
          if (t >= total) return resolve();
          let i = times.findIndex((s) => t >= s.start && t < s.end);
          if (i < 0) i = segs.length - 1;
          const shot = shotFor(i);
          if (i !== current) {
            if (current >= 0) { const prev = shotFor(current).el; if (prev instanceof HTMLVideoElement && prev !== shot.el) prev.pause(); }
            if (shot.el instanceof HTMLVideoElement) void shot.el.play().catch(() => undefined);
            current = i;
          }
          const span = times[i] ?? { start: 0, end: total };
          const local = (t - span.start) / Math.max(0.1, span.end - span.start);
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, H);
          drawCover(ctx, shot.el, shot.el instanceof HTMLImageElement ? 1 + 0.06 * local : 1);
          // On-screen disclosure, visible the whole video.
          ctx.font = "700 40px Figtree, Arial, sans-serif";
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.beginPath(); ctx.roundRect(60, 110, W - 120, 84, 20); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(`#ad  ${DISCLOSURE}`, W / 2, 152);
          const line = segs[i];
          if (i === 0) textBlock(ctx, line, H * 0.42, 76, "rgba(254,44,85,0.92)");
          else textBlock(ctx, line, H * 0.74, 56, i === segs.length - 1 ? "rgba(254,44,85,0.92)" : "rgba(0,0,0,0.65)");
          requestAnimationFrame(frame);
        };
        frame();
      });
      rec.stop();
      els.forEach((el) => el instanceof HTMLVideoElement && el.pause());
      const blob = await done;
      setResult({ url: URL.createObjectURL(blob), ext: blob.type.includes("mp4") ? "mp4" : ext, seconds: Math.round(total), aiVoice: voiceMode === "ai", h264: mime.includes("avc1") });
      rememberHook(script.hook);
    } catch (e) {
      setError(e instanceof Error ? noDashes(e.message) : "Rendering failed");
    } finally {
      setBusy("");
      void audio.close();
    }
  }

  const setLine = (i: number, v: string) => script && setScript({ ...script, lines: script.lines.map((l, j) => (j === i ? v : l)) });
  const caption = script ? postCaption(finalize(script)) : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-2"><Clapperboard className="w-7 h-7" /> Shop video maker</h1>
        <p className="text-dark-400 max-w-3xl">
          Turn a picked product into a vertical 9:16 video under 60 seconds: hook, script, captions, and a spoken and on-screen commission disclosure,
          built from your own product footage. You post it yourself and add the product link in the TikTok app. <Link href="/shop" className="text-brand-400 underline">Back to research</Link>
        </p>
      </div>

      <div className="cai-card space-y-3">
        <h2 className="text-lg font-semibold text-white">1. Product</h2>
        {picks.length ? (
          <select value={productId} onChange={(e) => choose(picks.find((p) => p.id === e.target.value) ?? null)} className="cai-input">
            <option value="">Choose one of your picks, or type below</option>
            {picks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : <p className="text-sm text-dark-400">No picks yet. Pick products on the <Link href="/shop" className="text-brand-400 underline">research page</Link>, or type one below.</p>}
        <div className="grid md:grid-cols-3 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" className="cai-input" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="cai-input" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price, e.g. 24.99" className="cai-input" />
        </div>
        <textarea value={benefits} onChange={(e) => setBenefits(e.target.value)} rows={3} className="cai-input" placeholder="What you actually noticed using it, one per line. Only claims you can show on camera." />
        <button onClick={generate} disabled={!name.trim() || !!busy} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-600 to-blue-600 text-white disabled:opacity-50 inline-flex items-center gap-2">
          <Wand2 className="w-4 h-4" /> {script ? "Write a new version" : "Write hook, script, and caption"}
        </button>
      </div>

      {script ? (
        <div className="cai-card space-y-3">
          <h2 className="text-lg font-semibold text-white">2. Script</h2>
          <p className="text-xs text-dark-500">{scriptSource} About {Math.round(estSeconds)} seconds spoken.</p>
          <label className="text-sm text-dark-300 block">Hook<input value={script.hook} onChange={(e) => setScript({ ...script, hook: e.target.value })} className="cai-input mt-1" /></label>
          {script.lines.map((l, i) => (
            <label key={i} className="text-sm text-dark-300 block">Line {i + 1}<input value={l} onChange={(e) => setLine(i, e.target.value)} className="cai-input mt-1" /></label>
          ))}
          <label className="text-sm text-dark-300 block">Call to action<input value={script.cta} onChange={(e) => setScript({ ...script, cta: e.target.value })} className="cai-input mt-1" /></label>
          <p className="text-sm text-dark-300">Disclosure (always spoken last and shown on screen the whole video): <span className="text-white">{DISCLOSURE}.</span></p>
        </div>
      ) : null}

      <div className="cai-card space-y-3">
        <h2 className="text-lg font-semibold text-white">3. Your footage</h2>
        <p className="text-sm text-dark-400 flex gap-2"><Hand className="w-4 h-4 mt-0.5 shrink-0" /> TikTok Shop needs real product presence. Upload at least one clip of you holding and using the product (phone video is fine). Photos can fill the rest.</p>
        <label className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-dark-800 text-dark-200 cursor-pointer inline-flex items-center gap-2">
          <Upload className="w-4 h-4" /> Add clips or photos
          <input type="file" multiple accept="video/*,image/*" className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </label>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {media.map((m) => (
            <div key={m.id} className="space-y-1">
              {m.kind === "video" ? <video src={m.url} muted className="w-full aspect-[9/16] object-cover rounded-lg bg-black" /> : <img src={m.url} alt={m.name} className="w-full aspect-[9/16] object-cover rounded-lg" />}
              {m.kind === "video" ? (
                <label className="text-xs text-dark-300 flex items-center gap-1"><input type="checkbox" checked={m.real} onChange={(e) => setMedia(media.map((x) => (x.id === m.id ? { ...x, real: e.target.checked } : x)))} /> Real hand-held clip</label>
              ) : <span className="text-xs text-dark-500">Photo</span>}
              <button onClick={() => setMedia(media.filter((x) => x.id !== m.id))} className="text-xs text-dark-500 underline">Remove</button>
            </div>
          ))}
        </div>
        {media.length && !hasReal ? <p className="text-sm text-amber-300 flex gap-2"><AlertTriangle className="w-4 h-4" /> Add a real clip of you with the product before posting. Photo only videos risk being flagged as low quality.</p> : null}
        <div className="flex flex-wrap gap-4 text-sm text-dark-300 items-center">
          <label className="flex items-center gap-2"><input type="radio" checked={voiceMode === "ai"} onChange={() => setVoiceMode("ai")} /> AI voiceover reads the script</label>
          {voiceMode === "ai" ? (
            <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="cai-input w-auto py-1.5">
              {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label} ({v.note})</option>)}
            </select>
          ) : null}
          <label className="flex items-center gap-2"><input type="radio" checked={voiceMode === "own"} onChange={() => { setVoiceMode("own"); setClipSound(true); }} /> My own voice from the clips</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={clipSound} onChange={(e) => setClipSound(e.target.checked)} /> Keep clip sound</label>
        </div>
        {voiceMode === "own" ? <p className="text-xs text-amber-300">Say &quot;{DISCLOSURE}&quot; out loud in your clip. It still shows on screen for the whole video.</p> : null}
        <button onClick={render} disabled={!script || !media.length || !!busy} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-600 to-blue-600 text-white disabled:opacity-50">
          Build 9:16 video
        </button>
        {busy ? <p className="text-sm text-dark-300">{busy}...</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <canvas ref={canvasRef} width={W} height={H} className={`w-full max-w-[270px] rounded-xl bg-black ${busy || result ? "" : "hidden"}`} />
      </div>

      {result && script ? (
        <div className="cai-card space-y-3">
          <h2 className="text-lg font-semibold text-white">4. Export and post</h2>
          <video src={result.url} controls className="w-full max-w-[270px] rounded-xl" />
          <a href={result.url} download={`${cleanName(name).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-tiktok.${result.ext}`} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white inline-flex items-center gap-2">
            <Download className="w-4 h-4" /> Download {result.ext.toUpperCase()} ({result.seconds}s)
          </a>
          {result.ext !== "mp4" ? <p className="text-xs text-amber-300">This browser can only record WebM. Open the page in a recent Chrome or Safari for MP4, or convert before uploading.</p> : null}
          {result.ext === "mp4" && !result.h264 ? <p className="text-xs text-amber-300">This browser saved MP4 with the VP9 codec. If TikTok rejects the upload, record in Chrome on Mac or Windows, or Safari, which save H.264.</p> : null}
          <label className="text-sm text-dark-300 block">Caption with hashtags
            <textarea value={caption} readOnly rows={3} className="cai-input mt-1" />
          </label>
          <button onClick={() => { void navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="px-3 py-1.5 rounded-lg bg-dark-800 text-dark-200 text-sm inline-flex items-center gap-1.5">
            <Copy className="w-4 h-4" /> {copied ? "Copied" : "Copy caption"}
          </button>
          <div className="rounded-xl border border-dark-700 p-4 text-sm text-dark-300 space-y-1">
            <p className="font-semibold text-white">Before you post in the TikTok app</p>
            <p>1. Upload the video on your shop account and paste the caption.</p>
            <p>2. Tap Add link, then Product, and attach this product from your showcase.</p>
            <p>3. Turn on Content disclosure, then Branded content or Your brand as fits the deal.</p>
            <p>4. AI content label: {result.aiVoice ? "this video uses an AI voice, so turn on the AI-generated content label." : "no AI voice was used. Turn on the AI-generated label anyway if any footage or images were AI made."}</p>
            <p>5. Check every claim matches the product page. Post 1 to 3 videos a day at most.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ShopVideoPage() {
  return <Suspense fallback={null}><VideoMaker /></Suspense>;
}
