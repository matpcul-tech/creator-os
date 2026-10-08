"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check, Copy, Download, ExternalLink, Image as ImageIcon, Loader2, Sparkles, Upload, Video, Youtube,
} from "lucide-react";
import { CONNECTORS, type Connector } from "@/lib/publish/connectors";
import { setYouTubeThumbnail, uploadYouTubeVideo, type YouTubePrivacy } from "@/lib/publish/youtube-upload";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { parseJSON } from "@/lib/utils";

type Piece = {
  id: number;
  title: string;
  body: string;
  hook?: string;
  platforms: string;
  variants: string;
  publishUrls?: string;
};

type YtStatus = { configured: boolean; connected: boolean; accountName: string };

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "video";
}

function downloadUrl(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

export function PostFlow({ piece, onPublished }: { piece: Piece; onPublished?: (urls: Record<string, string>) => void }) {
  const all = Object.values(CONNECTORS) as Connector[];
  const piecePlatforms = parseJSON<string[]>(piece.platforms, []);
  const [selected, setSelected] = useState<PlatformId[]>(
    () => all.filter((c) => piecePlatforms.includes(c.id)).map((c) => c.id),
  );
  const [captions, setCaptions] = useState<Record<string, string>>(() => parseJSON<Record<string, string>>(piece.variants, {}));
  const [urls, setUrls] = useState<Record<string, string>>(() => parseJSON<Record<string, string>>(piece.publishUrls, {}));
  const [posted, setPosted] = useState<Record<string, boolean>>({});
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumb, setThumb] = useState<{ src: string; name: string } | null>(null);
  const [yt, setYt] = useState<YtStatus | null>(null);
  const [privacy, setPrivacy] = useState<YouTubePrivacy>("private");
  const [busy, setBusy] = useState<string>("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");
  const [savedCaptions, setSavedCaptions] = useState(false);

  useEffect(() => {
    fetch("/api/youtube/status").then((r) => r.json()).then(setYt).catch(() => setYt(null));
    fetch(`/api/thumbnails?contentId=${piece.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((items: { dataUrl: string; format: string }[]) => {
        if (items?.[0]?.dataUrl) setThumb({ src: items[0].dataUrl, name: `${slug(piece.title)}-thumbnail.jpg` });
      })
      .catch(() => {});
  }, [piece.id, piece.title]);

  useEffect(() => {
    if (!video) return;
    const url = URL.createObjectURL(video);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  const active = useMemo(() => all.filter((c) => selected.includes(c.id)), [all, selected]);
  const note = (id: string, text: string) => setNotes((n) => ({ ...n, [id]: text }));

  function toggle(id: PlatformId) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function assist(c: Connector) {
    setBusy(`ai:${c.id}`);
    note(c.id, "");
    try {
      const res = await fetch("/api/ai/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: c.id, title: piece.title, script: piece.body, draft: captions[c.id] || "" }),
      });
      const json = await res.json();
      if (!res.ok) return note(c.id, json.error || "Caption help isn't available right now.");
      setCaptions((cap) => ({ ...cap, [c.id]: json.caption }));
    } catch {
      note(c.id, "Caption help isn't available right now.");
    } finally {
      setBusy("");
    }
  }

  async function saveCaptions() {
    const current = parseJSON<Record<string, string>>(piece.variants, {});
    await fetch(`/api/content/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variants: { ...current, ...captions } }),
    });
    setSavedCaptions(true);
    setTimeout(() => setSavedCaptions(false), 1500);
  }

  async function copy(c: Connector) {
    try {
      await navigator.clipboard.writeText(captions[c.id] || "");
      setCopied(c.id);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      note(c.id, "Couldn't copy. Select the caption and copy it by hand.");
    }
  }

  async function markPosted(c: Connector, url: string) {
    const res = await fetch(`/api/content/${piece.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: url ? { [c.id]: url } : {} }),
    });
    if (!res.ok) return note(c.id, "Couldn't mark it as published. Please try again.");
    setPosted((p) => ({ ...p, [c.id]: true }));
    const next = url ? { ...urls, [c.id]: url } : urls;
    setUrls(next);
    note(c.id, "Marked as published.");
    onPublished?.(next);
  }

  // Real posting. Only YouTube has an API connector today.
  async function postNow(c: Connector) {
    if (!video) return note(c.id, "Choose the exported video file first.");
    const ok = window.confirm(
      `Upload "${piece.title}" to YouTube as ${privacy}? This posts to your real channel.`,
    );
    if (!ok) return;
    setBusy(`post:${c.id}`);
    note(c.id, "Uploading to YouTube. Keep this tab open...");
    try {
      const tokenRes = await fetch("/api/youtube/token", { method: "POST" });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) return note(c.id, tokenJson.error || "YouTube isn't connected.");
      const caption = captions[c.id] || piece.body.slice(0, 4000);
      const description = c.id === "youtube_shorts" && !/#shorts/i.test(caption) ? `${caption}\n\n#Shorts` : caption;
      const { videoId, url } = await uploadYouTubeVideo({
        accessToken: tokenJson.accessToken,
        video,
        title: piece.title,
        description,
        privacyStatus: privacy,
      });
      let thumbNote = "";
      if (thumb && c.id === "youtube") {
        try {
          const blob = await (await fetch(thumb.src)).blob();
          await setYouTubeThumbnail({ accessToken: tokenJson.accessToken, videoId, image: blob });
        } catch (e) {
          thumbNote = ` ${e instanceof Error ? e.message : "The thumbnail was not set."}`;
        }
      }
      await markPosted(c, url);
      note(c.id, `Posted to YouTube (${privacy}).${thumbNote}`);
    } catch (e) {
      note(c.id, e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setBusy("");
    }
  }

  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${on ? "bg-brand-500/15 border-brand-500/40 text-white" : "bg-dark-800/30 border-dark-700/40 text-dark-400 hover:text-white"}`;
  const small = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800/50 text-dark-200 hover:text-white border border-dark-700/50 disabled:opacity-50";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-2">1. Platforms</p>
        <div className="flex flex-wrap gap-2">
          {all.map((c) => (
            <button key={c.id} onClick={() => toggle(c.id)} className={chip(selected.includes(c.id))} aria-pressed={selected.includes(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-2">2. Video and thumbnail</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 rounded-xl border border-dark-700/50 bg-dark-800/30 p-3 cursor-pointer">
            <Video size={18} className="text-brand-400 shrink-0" />
            <span className="min-w-0 text-sm">
              <span className="block text-white truncate">{video ? video.name : "Choose the exported video"}</span>
              <span className="block text-xs text-dark-500">{video ? `${(video.size / 1_000_000).toFixed(1)} MB` : "MP4 or WebM from the Faceless builder"}</span>
            </span>
            <input type="file" accept="video/*" className="sr-only" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-dark-700/50 bg-dark-800/30 p-3 cursor-pointer">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb.src} alt="Thumbnail" className="h-10 w-16 rounded object-cover shrink-0" />
            ) : (
              <ImageIcon size={18} className="text-brand-400 shrink-0" />
            )}
            <span className="min-w-0 text-sm">
              <span className="block text-white truncate">{thumb ? "Thumbnail attached" : "Add a thumbnail"}</span>
              <span className="block text-xs text-dark-500">{thumb ? "Tap to replace" : "Upload, or make one in Thumbnails"}</span>
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setThumb({ src: URL.createObjectURL(f), name: f.name });
              }}
            />
          </label>
        </div>
        {!thumb ? (
          <a href={`/thumbnails?title=${encodeURIComponent(piece.title)}&contentId=${piece.id}`} className="mt-2 inline-block text-xs text-brand-300 hover:text-white">
            Make a thumbnail for this piece
          </a>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wider font-semibold text-dark-500">3. Captions and posting</p>
          {active.length ? (
            <button onClick={saveCaptions} className="text-xs text-brand-300 hover:text-white">
              {savedCaptions ? "Captions saved" : "Save captions"}
            </button>
          ) : null}
        </div>
        {active.length === 0 ? <p className="text-sm text-dark-500">Pick at least one platform above.</p> : null}
        <div className="space-y-4">
          {active.map((c) => {
            const Icon = PLATFORMS[c.id]?.icon;
            const text = captions[c.id] || "";
            const isYouTube = c.mode === "api" && c.id.startsWith("youtube");
            const ytReady = isYouTube && yt?.connected;
            return (
              <div key={c.id} className="rounded-xl border border-dark-700/50 bg-dark-900/40 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {Icon ? <Icon size={16} className="text-brand-400" /> : null}
                    <span className="text-sm font-semibold text-white">{c.name}</span>
                    {posted[c.id] || urls[c.id] ? <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5">Published</span> : null}
                  </div>
                  <span className={`text-[11px] ${text.length > c.captionLimit ? "text-red-300" : "text-dark-500"}`}>
                    {text.length}/{c.captionLimit}
                  </span>
                </div>
                <label htmlFor={`cap-${c.id}`} className="sr-only">{c.name} caption</label>
                <textarea
                  id={`cap-${c.id}`}
                  value={text}
                  onChange={(e) => setCaptions((cap) => ({ ...cap, [c.id]: e.target.value }))}
                  className="cai-input min-h-[90px] text-sm"
                  placeholder={`Caption for ${c.name}`}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => assist(c)} disabled={busy === `ai:${c.id}`} className={small}>
                    {busy === `ai:${c.id}` ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI caption
                  </button>
                </div>

                {isYouTube ? (
                  <div className="mt-3 pt-3 border-t border-dark-800/60">
                    {ytReady ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={`privacy-${c.id}`} className="text-xs text-dark-400">Visibility</label>
                        <select id={`privacy-${c.id}`} value={privacy} onChange={(e) => setPrivacy(e.target.value as YouTubePrivacy)} className="cai-input !w-auto !py-1.5 text-xs">
                          <option value="private">Private</option>
                          <option value="unlisted">Unlisted</option>
                          <option value="public">Public</option>
                        </select>
                        <button onClick={() => postNow(c)} disabled={Boolean(busy) || !video} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-red-600 to-rose-600 text-white disabled:opacity-50">
                          {busy === `post:${c.id}` ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Post now
                        </button>
                        {yt?.accountName ? <span className="text-[11px] text-dark-500">to {yt.accountName}</span> : null}
                      </div>
                    ) : yt?.configured ? (
                      <a href="/api/youtube/connect" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-600/90 text-white">
                        <Youtube size={14} /> Connect YouTube
                      </a>
                    ) : (
                      <p className="text-xs text-dark-500">YouTube posting isn&apos;t set up yet. Use the share kit below for now.</p>
                    )}
                  </div>
                ) : null}

                {!ytReady ? (
                  <div className="mt-3 pt-3 border-t border-dark-800/60">
                    <p className="text-[11px] text-dark-500 mb-2">
                      Share kit{c.note ? `. ${c.note}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => copy(c)} disabled={!text} className={small}>
                        {copied === c.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />} Copy caption
                      </button>
                      <button onClick={() => videoUrl && downloadUrl(videoUrl, video?.name || `${slug(piece.title)}.mp4`)} disabled={!videoUrl} className={small}>
                        <Download size={12} /> Video
                      </button>
                      <button onClick={() => thumb && downloadUrl(thumb.src, thumb.name)} disabled={!thumb} className={small}>
                        <Download size={12} /> Thumbnail
                      </button>
                      <a href={c.uploadUrl} target="_blank" rel="noreferrer" className={small}>
                        <ExternalLink size={12} /> Open upload page
                      </a>
                    </div>
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <label htmlFor={`url-${c.id}`} className="sr-only">Live post URL</label>
                      <input
                        id={`url-${c.id}`}
                        value={urls[c.id] || ""}
                        onChange={(e) => setUrls((u) => ({ ...u, [c.id]: e.target.value }))}
                        placeholder="Paste the live post URL (optional)"
                        className="cai-input flex-1 !py-2 text-xs"
                      />
                      <button onClick={() => markPosted(c, (urls[c.id] || "").trim())} className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600/80 text-white">
                        I posted it
                      </button>
                    </div>
                  </div>
                ) : null}

                {notes[c.id] ? <p role="status" className="mt-2 text-xs text-amber-200">{notes[c.id]}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
