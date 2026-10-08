"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Loader2, Paperclip, Search, Sparkles, Check } from "lucide-react";
import {
  THUMB_SIZES,
  drawThumbnail,
  layoutAnchor,
  palettes,
  type ThumbFormat,
  type ThumbLayout,
  type ThumbPalette,
} from "@/lib/thumbnail/render";

const LAYOUTS: { id: ThumbLayout; name: string }[] = [
  { id: "bottom", name: "Bottom left" },
  { id: "center", name: "Center" },
  { id: "band", name: "Color band" },
];

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "thumbnail";
}

export function ThumbnailMaker({
  title,
  hook = "",
  contentId,
  onAttached,
}: {
  title: string;
  hook?: string;
  contentId?: number | null;
  onAttached?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [format, setFormat] = useState<ThumbFormat>("youtube");
  const [layout, setLayout] = useState<ThumbLayout>("bottom");
  const [paletteList, setPaletteList] = useState<ThumbPalette[]>(palettes());
  const [paletteId, setPaletteId] = useState("yellow");
  const [text, setText] = useState(() => title.split(/\s+/).slice(0, 5).join(" "));
  const [anchor, setAnchor] = useState(layoutAnchor("bottom", "youtube"));
  const [scale, setScale] = useState(1);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  // Photos not shown yet, and every photo already shown, so "Try another photo" never repeats one.
  const [photoQueue, setPhotoQueue] = useState<{ src: string; url: string }[]>([]);
  const shownPhotos = useRef<Set<string>>(new Set());
  const [photoCount, setPhotoCount] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "photo" | "ai" | "attach">("");
  const [note, setNote] = useState("");
  const [attached, setAttached] = useState(false);
  const dragging = useRef(false);

  // Brand DNA colors become the first preset when they are set.
  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((b) => {
        const list = palettes(b);
        setPaletteList(list);
        if (list[0]?.id === "brand") setPaletteId("brand");
      })
      .catch(() => {});
  }, []);

  const palette = paletteList.find((p) => p.id === paletteId) ?? paletteList[0];

  const redraw = useCallback(() => {
    if (!canvasRef.current || !palette) return;
    drawThumbnail(canvasRef.current, { format, layout, palette, text, anchor, scale, image });
  }, [format, layout, palette, text, anchor, scale, image]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function pickLayout(next: ThumbLayout) {
    setLayout(next);
    setAnchor(layoutAnchor(next, format));
  }
  function pickFormat(next: ThumbFormat) {
    setFormat(next);
    setAnchor(layoutAnchor(layout, next));
  }

  function loadImage(src: string) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setNote("That photo didn't load. Try another or upload your own.");
    img.src = src;
  }

  // Photos come from the same stock source as the Faceless builder.
  function showPhoto(photo: { src: string; url: string }) {
    shownPhotos.current.add(photo.src);
    setPhotoCount(shownPhotos.current.size);
    loadImage(photo.url);
  }

  async function findPhoto() {
    if (photoQueue.length) {
      const [next, ...rest] = photoQueue;
      setPhotoQueue(rest);
      showPhoto(next);
      return;
    }
    setBusy("photo");
    setNote("");
    try {
      const lines = [title, hook, text].map((l) => l.trim()).filter(Boolean);
      const res = await fetch("/api/ai/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.slice(0, 1),
          topic: lines.join(" "),
          exclude: [...shownPhotos.current].slice(-400),
          extra: 15,
        }),
      });
      const json = (await res.json()) as {
        items?: ({ src: string; url: string } | null)[];
        pool?: { src: string; url: string }[];
      };
      const seen = new Set(shownPhotos.current);
      const found: { src: string; url: string }[] = [];
      for (const item of [...(json.items ?? []), ...(json.pool ?? [])]) {
        if (!item || seen.has(item.src)) continue;
        seen.add(item.src);
        found.push(item);
      }
      if (!found.length) {
        setNote(
          shownPhotos.current.size
            ? "That's every matching photo we could find. Upload your own, or edit the text to search for something else."
            : "No matching photo found. Upload your own, or keep the color background.",
        );
        return;
      }
      const [first, ...rest] = found;
      setPhotoQueue(rest);
      showPhoto(first);
    } catch {
      setNote("Photo search didn't answer. Try again or upload your own.");
    } finally {
      setBusy("");
    }
  }

  function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNote("Please choose an image file.");
      return;
    }
    loadImage(URL.createObjectURL(file));
  }

  async function suggest() {
    setBusy("ai");
    setNote("");
    try {
      const res = await fetch("/api/ai/thumbnail-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, hook }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNote(json.error || "Couldn't get suggestions right now.");
        return;
      }
      setSuggestions(json.options ?? []);
    } catch {
      setNote("Couldn't get suggestions right now.");
    } finally {
      setBusy("");
    }
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug(text || title)}-${THUMB_SIZES[format].w}x${THUMB_SIZES[format].h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }

  async function attach() {
    const canvas = canvasRef.current;
    if (!canvas || !contentId) return;
    setBusy("attach");
    setNote("");
    try {
      const res = await fetch("/api/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, format, text, dataUrl: canvas.toDataURL("image/jpeg", 0.88) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(json.error || "Couldn't attach the thumbnail.");
        return;
      }
      setAttached(true);
      setTimeout(() => setAttached(false), 2000);
      onAttached?.();
    } catch {
      setNote("Couldn't attach the thumbnail.");
    } finally {
      setBusy("");
    }
  }

  // Drag on the preview to move the text.
  function moveTo(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(0.98, Math.max(0.02, (e.clientX - rect.left) / rect.width));
    const y = Math.min(0.98, Math.max(0.05, (e.clientY - rect.top) / rect.height));
    setAnchor({ x, y });
  }

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
      active ? "bg-brand-500/15 border-brand-500/40 text-white" : "bg-dark-800/30 border-dark-700/40 text-dark-400 hover:text-white"
    }`;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="min-w-0">
        <div className={`mx-auto ${format === "vertical" ? "max-w-[300px]" : ""}`}>
          <canvas
            ref={canvasRef}
            aria-label="Thumbnail preview. Drag to move the text."
            className="w-full h-auto rounded-xl border border-dark-700/50 touch-none cursor-move bg-dark-900"
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              moveTo(e);
            }}
            onPointerMove={(e) => dragging.current && moveTo(e)}
            onPointerUp={() => (dragging.current = false)}
          />
        </div>
        <p className="mt-2 text-center text-xs text-dark-500">Drag on the preview to move the text.</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-2 block">Size</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(THUMB_SIZES) as ThumbFormat[]).map((f) => (
              <button key={f} onClick={() => pickFormat(f)} className={chip(format === f)}>
                {THUMB_SIZES[f].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="thumb-text" className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-2 block">Text</label>
          <input id="thumb-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={60} className="cai-input" placeholder="3 to 5 words" />
          <button onClick={suggest} disabled={busy === "ai"} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-300 hover:text-white disabled:opacity-50">
            {busy === "ai" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Suggest text with AI
          </button>
          {suggestions.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s} onClick={() => setText(s)} className={chip(text === s)}>{s}</button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <label htmlFor="thumb-scale" className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-2 block">Text size</label>
          <input id="thumb-scale" type="range" min={0.6} max={1.6} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full" />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-2 block">Layout</label>
          <div className="flex flex-wrap gap-2">
            {LAYOUTS.map((l) => (
              <button key={l.id} onClick={() => pickLayout(l.id)} className={chip(layout === l.id)}>{l.name}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-2 block">Colors</label>
          <div className="flex flex-wrap gap-2">
            {paletteList.map((p) => (
              <button key={p.id} onClick={() => setPaletteId(p.id)} className={`${chip(paletteId === p.id)} inline-flex items-center gap-1.5`}>
                <span className="inline-block h-3 w-3 rounded-full border border-black/40" style={{ background: p.fill }} />
                <span className="inline-block h-3 w-3 rounded-full border border-black/40" style={{ background: p.band }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-2 block">Background photo</label>
          <div className="flex flex-wrap gap-2">
            <button onClick={findPhoto} disabled={busy === "photo"} className={`${chip(false)} inline-flex items-center gap-1.5`}>
              {busy === "photo" ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              {photoCount > 0 ? "Try another photo" : "Find a photo"}
            </button>
            <label className={`${chip(false)} inline-flex items-center gap-1.5 cursor-pointer`}>
              <ImagePlus size={12} /> Upload
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            {image ? (
              <button onClick={() => setImage(null)} className={chip(false)}>Remove photo</button>
            ) : null}
          </div>
          <p className="mt-1.5 text-[11px] text-dark-500">Stock photos come from Wikimedia Commons. Check the license before commercial use.</p>
        </div>

        {note ? <p role="alert" className="text-sm text-amber-200">{note}</p> : null}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-dark-800/50">
          <button onClick={download} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-600 to-blue-600 text-white">
            <Download size={14} /> Download PNG
          </button>
          {contentId ? (
            <button onClick={attach} disabled={busy === "attach"} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-dark-800/60 text-white border border-dark-700 disabled:opacity-50">
              {attached ? <><Check size={14} className="text-emerald-400" /> Attached</> : busy === "attach" ? <><Loader2 size={14} className="animate-spin" /> Attaching...</> : <><Paperclip size={14} /> Attach to piece</>}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
