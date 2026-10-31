"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Loader2 } from "lucide-react";
import { cardsFromScript } from "@/lib/produce/cards";
import { DEFAULT_VOICE, type Aspect, type JobView, type SceneCard, type VoiceSettings } from "@/lib/produce/types";

type Props = {
  script: string;
  title: string;
  contentId: number | null;
  onContent: (id: number) => void;
};

const emptyVoice: VoiceSettings = { voiceId: "", ...DEFAULT_VOICE };

export function ProduceVideo({ script, title, contentId, onContent }: Props) {
  const [cards, setCards] = useState<SceneCard[]>(() => cardsFromScript(script, title));
  const [voice, setVoice] = useState<VoiceSettings>(emptyVoice);
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const onContentRef = useRef(onContent);
  onContentRef.current = onContent;

  useEffect(() => {
    setCards(cardsFromScript(script, title));
  }, [script, title]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/produce/${job.jobId}`);
        const json = (await res.json()) as JobView & { error?: string };
        if (!res.ok) {
          setError(json.error || "Could not read render status.");
          return;
        }
        setJob(json);
        if (json.contentId) onContentRef.current(json.contentId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read render status.");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [job]);

  function patchCard(index: number, patch: Partial<SceneCard>) {
    setCards((current) => current.map((card, i) => (i === index ? { ...card, ...patch } : card)));
  }

  async function produce() {
    if (starting || !voice.voiceId.trim()) return;
    setError("");
    setJob(null);
    setStarting(true);
    try {
      const res = await fetch("/api/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || cards[0]?.title || "Untitled",
          aspect,
          contentId,
          voice,
          scenes: cards,
        }),
      });
      const json = (await res.json()) as JobView & { error?: string; contentId?: number | null };
      if (!res.ok) {
        setError(json.error || "Could not start the render.");
        return;
      }
      if (json.contentId) onContent(json.contentId);
      setJob(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the render.");
    } finally {
      setStarting(false);
    }
  }

  const busy = starting || (!!job && job.status !== "completed" && job.status !== "failed");

  return (
    <div className="space-y-5">
      <p className="text-sm text-dark-400">
        One action builds the finished file from these scene cards: voice, pictures, and burned in captions.
        The file is saved on the planner item and shows on the calendar.
      </p>

      <div className="flex flex-wrap gap-2">
        {([
          ["9:16", "Shorts, 1080x1920"],
          ["16:9", "Long form, 1920x1080"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAspect(id)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border ${
              aspect === id
                ? "bg-brand-500/15 border-brand-500/40 text-brand-300"
                : "bg-dark-800/30 border-dark-700/40 text-dark-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-dark-400 block sm:col-span-2">
          Locked voice ID
          <input
            value={voice.voiceId}
            onChange={(e) => setVoice({ ...voice, voiceId: e.target.value.trim() })}
            placeholder="ElevenLabs voice ID"
            className="cai-input mt-1"
          />
        </label>
        <Num label="Stability" value={voice.stability} min={0} max={1} step={0.05} onChange={(stability) => setVoice({ ...voice, stability })} />
        <Num label="Similarity" value={voice.similarity_boost} min={0} max={1} step={0.05} onChange={(similarity_boost) => setVoice({ ...voice, similarity_boost })} />
        <Num label="Style" value={voice.style} min={0} max={1} step={0.05} onChange={(style) => setVoice({ ...voice, style })} />
        <Num label="Speed" value={voice.speed} min={0.7} max={1.2} step={0.05} onChange={(speed) => setVoice({ ...voice, speed })} />
        <label className="text-xs text-dark-400 flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={voice.use_speaker_boost}
            onChange={(e) => setVoice({ ...voice, use_speaker_boost: e.target.checked })}
          />
          Speaker boost
        </label>
      </div>

      <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
        {cards.map((card, index) => (
          <div key={`${index}-${card.narration.slice(0, 24)}`} className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-dark-500">Scene {index + 1}</div>
            <input value={card.title} onChange={(e) => patchCard(index, { title: e.target.value })} className="cai-input" />
            <textarea value={card.narration} onChange={(e) => patchCard(index, { narration: e.target.value })} className="cai-input min-h-[72px] text-sm" />
            <div className="grid sm:grid-cols-[1fr_120px] gap-2">
              <input value={card.visual} onChange={(e) => patchCard(index, { visual: e.target.value })} className="cai-input text-sm" />
              <input
                type="number"
                min={0}
                max={180}
                value={card.duration}
                onChange={(e) => patchCard(index, { duration: Number(e.target.value) })}
                className="cai-input text-sm"
                aria-label={`Scene ${index + 1} duration seconds`}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={produce}
        disabled={busy || !voice.voiceId.trim() || cards.length === 0}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
        {busy ? "Producing…" : "Produce Video"}
      </button>

      {job && job.status !== "failed" ? (
        <div className="space-y-2">
          <div className="h-1.5 rounded-full bg-dark-800 overflow-hidden">
            <div className="h-full bg-brand-400" style={{ width: `${Math.max(4, job.progress)}%` }} />
          </div>
          <p className="text-sm text-dark-300">{job.message}</p>
          {job.status === "completed" && job.videoUrl ? (
            <video src={job.videoUrl} controls playsInline className="w-full max-w-md rounded-xl border border-dark-700/40 bg-black" />
          ) : null}
        </div>
      ) : null}

      {error || job?.status === "failed" ? (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error || job?.error || "Render failed."}
        </div>
      ) : null}
    </div>
  );
}

function Num({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs text-dark-400 block">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="cai-input mt-1"
      />
    </label>
  );
}
