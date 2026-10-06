"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

export function PictorySend({ title, script }: { title: string; script: string }) {
  const [status, setStatus] = useState("Pictory adds the stock, voice, and captions. Creator OS does not render this cut.");
  const [jobId, setJobId] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);

  async function openFallback() {
    await navigator.clipboard.writeText(script);
    window.open("https://app.pictory.ai/", "_blank", "noopener,noreferrer");
    setStatus("Script copied. In Pictory choose Script to Video and paste it.");
  }

  async function send() {
    setBusy(true);
    setPreview("");
    setStatus("Sending the script to Pictory…");
    try {
      const res = await fetch("/api/pictory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, script }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(json.error || "Pictory rejected the script.");
        return;
      }
      setJobId(json.jobId || "");
      setStatus(json.jobId ? "Pictory is building the storyboard. Check status in a minute." : "Sent. Pictory did not return a job id.");
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!jobId) return;
    const res = await fetch("/api/pictory?jobId=" + encodeURIComponent(jobId));
    const json = await res.json();
    const data = json.data || json;
    const url = data.previewUrl || data.videoUrl || data.renderUrl || "";
    if (url) setPreview(url);
    setStatus(data.status || json.status || "Still working.");
  }

  return (
    <div className="mt-4 rounded-xl border border-dark-700/40 p-4">
      <p className="text-sm text-dark-300">Send this script to Pictory. No talking-head avatar.</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={send} disabled={busy || script.length < 20} className="px-3 py-1.5 rounded-lg text-xs bg-brand-500/15 text-brand-300">Send to Pictory</button>
        <button onClick={check} disabled={!jobId} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white">Check status</button>
        <button onClick={openFallback} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-white inline-flex items-center gap-1">Copy and open Pictory <ExternalLink size={12} /></button>
      </div>
      <p className="text-xs text-dark-500 mt-3">{status}</p>
      {preview ? <a href={preview} target="_blank" rel="noreferrer" className="text-xs text-brand-400">Open Pictory preview</a> : null}
    </div>
  );
}
