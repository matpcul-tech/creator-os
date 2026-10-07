"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Mic } from "lucide-react";

type Scene = { caption: string; voice: string; visual: string; media: HTMLImageElement | null; credit: string; seconds: number };
type StockInfo = { url: string; thumburl?: string; size?: number; descriptionurl?: string };
const STOP = new Set("the a an and or to for of in on your is it not then with this that from just does have will here what".split(" "));
const VISUAL: [RegExp, string][] = [
  [/sleep|bed|night/, "person sleeping dark bedroom"],
  [/walk|run|cardio|vo2|treadmill|fitness/, "person running on treadmill"],
  [/lift|muscle|strength|grip|deadlift/, "person lifting weights"],
  [/food|eat|meal|diet/, "healthy meal on a plate"],
  [/supplement|pill|bottle/, "supplement bottles on a table"],
  [/friend|social|lonely|people/, "friends eating together"],
  [/study|trial|research|paper|data/, "scientific research papers"],
  [/clock|year|time|stopwatch/, "stopwatch close up"],
  [/city|street/, "city street daylight"],
];

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
function visualFrom(line: string) {
  const lower = line.toLowerCase();
  for (const [re, q] of VISUAL) if (re.test(lower)) return q;
  const words = lower.replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
  return (words.slice(0, 3).join(" ") || "daylight landscape") + " photograph";
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
    const visual = clean((roll?.[1] || "").split(/[.,]/)[0] || "") || visualFrom(spoken || lines[0]);
    lines.forEach((caption) => labeled.push({ caption, voice: spoken || caption, visual, media: null, credit: "", seconds: seconds / lines.length }));
  }
  if (labeled.length) return labeled.slice(0, 24);
  const lines = script.split(/\n+/).map(clean).filter((line) => line.length > 12 && !isHeading(line)).slice(0, 16);
  return lines.map((caption) => ({ caption, voice: caption, visual: visualFrom(caption), media: null, credit: "", seconds: Math.max(4.5, caption.split(/\s+/).length / 2.3) }));
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
  ctx.drawImage(media, dx + (dw - w * scale) / 2, dy + (dh - h * scale) / 2, w * scale, h * scale);
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
  const voiceFromFile = useRef(false);
  const mixRef = useRef<{ el: HTMLAudioElement; ctx: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);
  const [text, setText] = useState(script);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [status, setStatus] = useState("No B-roll needed. Photos come from the spoken lines.");
  const [fileUrl, setFileUrl] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [busy, setBusy] = useState(false);
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
    setStatus(parsed.length + " cards. Photos will be searched from the lines. About " + Math.round(total) + " seconds.");
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
    setStatus(built.filter((s) => s.media).length + " of " + built.length + " cards have a photo. No B-roll block required.");
    return built;
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
    a.download = (title || "faceless").slice(0, 40).replace(/\s+/g, "-") + ".webm";
    a.click();
    if (contentId) {
      const req = indexedDB.open("faceless-builder", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("cuts");
      req.onsuccess = () => req.result.transaction("cuts", "readwrite").objectStore("cuts").put(blob, String(contentId));
    }
    setStatus("Downloaded. Photos were matched from the lines, not from a B-roll block.");
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <canvas ref={canvasRef} width={720} height={1280} className="w-full max-w-[220px] rounded-2xl bg-black" />
      <div>
        <textarea value={text} onChange={(e) => { setText(e.target.value); scenesRef.current = []; if (!voiceFromFile.current) voiceRef.current = null; }} className="cai-input min-h-[160px] text-sm" />
        <label className="mt-3 flex items-center gap-2 text-xs text-dark-300">
          <Mic size={12} /> Voice file
          <input type="file" accept="audio/*" onChange={(e) => {
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
          <button onClick={findStock} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1"><ImageIcon size={12} /> Find photos</button>
          <button onClick={() => void speak()} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white flex items-center gap-1"><Mic size={12} /> Play voice</button>
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
