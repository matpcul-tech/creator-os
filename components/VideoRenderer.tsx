"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Loader2, Play, AlertTriangle, Download } from "lucide-react";

type Props = {
  script: string;
  title?: string;
  contentId?: number;
  initialVideoId?: string;
  initialVideoUrl?: string;
  initialVideoStatus?: string;
};

type Status = "" | "generating" | "pending" | "completed" | "failed";

export function VideoRenderer({
  script,
  title,
  contentId,
  initialVideoId = "",
  initialVideoUrl = "",
  initialVideoStatus = "",
}: Props) {
  const [videoId, setVideoId] = useState(initialVideoId);
  const [status, setStatus] = useState<Status>(initialVideoStatus as Status);
  const [url, setUrl] = useState(initialVideoUrl);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPoll() {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function poll(id: string) {
    try {
      const qs = contentId ? `?contentId=${contentId}` : "";
      const res = await fetch(`/api/ai/video/${id}${qs}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        setStatus("failed");
        return;
      }
      setStatus(json.status);
      if (json.url) setUrl(json.url);
      if (json.status === "completed" || json.status === "failed") return;
      pollTimer.current = setTimeout(() => poll(id), 5000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("failed");
    }
  }

  // Resume polling if we mount with a render already in flight.
  useEffect(() => {
    if (videoId && (status === "generating" || status === "pending")) {
      poll(videoId);
    }
    return clearPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function render() {
    if (!script.trim() || submitting) return;
    setError("");
    setUrl("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/ai/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, title, contentId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || `Render failed (${res.status})`);
        setStatus("failed");
        return;
      }
      setVideoId(json.videoId);
      setStatus(json.status || "generating");
      poll(json.videoId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("failed");
    } finally {
      setSubmitting(false);
    }
  }

  const busy =
    submitting || status === "generating" || status === "pending";

  const charCount = script.trim().length;
  const approxMinutes = Math.max(1, Math.round(charCount / 900));

  return (
    <div className="space-y-4">
      {status === "completed" && url ? (
        <div className="space-y-3">
          <video
            src={url}
            controls
            playsInline
            className="w-full rounded-xl border border-dark-700/40 bg-black"
          />
          <div className="flex items-center gap-3">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800/40 text-dark-300 hover:text-white transition-all"
            >
              <Download size={12} />
              Open MP4
            </a>
            <button
              onClick={render}
              disabled={busy || !script.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800/40 text-dark-300 hover:text-white transition-all disabled:opacity-50"
            >
              <Play size={12} />
              Re-render
            </button>
          </div>
        </div>
      ) : null}

      {status !== "completed" ? (
        <div className="rounded-xl bg-dark-800/30 border border-dark-700/40 p-4">
          {busy ? (
            <div className="flex items-center gap-3 text-sm text-dark-300">
              <Loader2 size={16} className="animate-spin text-brand-400" />
              <span>
                {status === "pending" ? "Queued at HeyGen…" : "Rendering your avatar…"}
                <span className="text-dark-500 ml-2">
                  (~30-90s per minute of audio)
                </span>
              </span>
            </div>
          ) : status === "failed" ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-red-300">
                <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <span>{error || "Render failed."}</span>
              </div>
              <button
                onClick={render}
                disabled={!script.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 transition-all disabled:opacity-50"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-dark-400">
                {charCount === 0
                  ? "Write a script first, then render it with your cloned avatar + voice."
                  : `Renders ~${approxMinutes} minute${approxMinutes === 1 ? "" : "s"} of talking-head video using your HeyGen avatar and voice.`}
              </div>
              <button
                onClick={render}
                disabled={!script.trim() || submitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Film size={14} />
                {submitting ? "Submitting…" : "Render avatar video"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
