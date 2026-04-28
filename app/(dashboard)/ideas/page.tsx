"use client";

import { useEffect, useState } from "react";
import {
  Lightbulb,
  Sparkles,
  Loader2,
  Plus,
  ArrowUpRight,
  Trash2,
  Wand2,
  Star,
} from "lucide-react";
import Link from "next/link";
import { PLATFORMS, type PlatformId, PLATFORM_LIST } from "@/lib/platforms";
import { parseJSON, relativeTime } from "@/lib/utils";

type Idea = {
  id: number;
  title: string;
  hook: string;
  angle: string;
  platform: string;
  tags: string;
  score: number;
  source: string;
  archived: boolean;
  createdAt: string;
};

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [filter, setFilter] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [newIdea, setNewIdea] = useState({ title: "", hook: "", angle: "" });

  async function load() {
    const res = await fetch("/api/ideas");
    const data = await res.json();
    setIdeas(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    try {
      await fetch("/api/ai/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic || undefined, count }),
      });
      await load();
    } finally {
      setGenerating(false);
    }
  }

  async function archive(id: number) {
    await fetch(`/api/ideas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }

  async function promote(id: number) {
    const res = await fetch(`/api/ideas/${id}/promote`, { method: "POST" });
    if (res.ok) {
      setIdeas((prev) => prev.filter((i) => i.id !== id));
    }
  }

  async function createManual() {
    if (!newIdea.title) return;
    await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newIdea, source: "manual" }),
    });
    setNewIdea({ title: "", hook: "", angle: "" });
    setShowNew(false);
    await load();
  }

  const filtered =
    filter === "all" ? ideas : ideas.filter((i) => i.platform === filter);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Ideas</h1>
          <p className="text-dark-400">
            Brainstorm, store, and ship. Generate fresh ideas in your voice with Claude, or add your own.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2.5 rounded-xl glass text-sm font-medium hover:border-brand-500/30 transition-all flex items-center gap-2"
        >
          <Plus size={16} /> Add manually
        </button>
      </div>

      {/* AI generation card */}
      <div className="cai-card border-brand-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Wand2 size={18} className="text-brand-400" />
          <h2 className="text-lg font-bold text-white">Generate ideas</h2>
        </div>
        <div className="grid md:grid-cols-[1fr_auto_auto] gap-3">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Optional topic (e.g. 'building in public', 'AI productivity', 'creator monetization')"
            className="cai-input"
          />
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="cai-input md:w-32"
          >
            {[5, 8, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n} ideas
              </option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={generating}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Thinking…
              </>
            ) : (
              <>
                <Sparkles size={16} /> Generate
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-dark-500 mt-3">
          Uses your profile + voice to generate niche-aware ideas. Each gets a quality score 1–10.
        </p>
      </div>

      {/* Manual idea modal */}
      {showNew ? (
        <div className="cai-card">
          <h3 className="text-base font-bold text-white mb-3">New idea</h3>
          <div className="space-y-3">
            <input
              value={newIdea.title}
              onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })}
              placeholder="Title"
              className="cai-input"
            />
            <input
              value={newIdea.hook}
              onChange={(e) => setNewIdea({ ...newIdea, hook: e.target.value })}
              placeholder="Opening hook"
              className="cai-input"
            />
            <input
              value={newIdea.angle}
              onChange={(e) => setNewIdea({ ...newIdea, angle: e.target.value })}
              placeholder="Angle / why this matters"
              className="cai-input"
            />
            <div className="flex gap-2">
              <button
                onClick={createManual}
                className="px-4 py-2 rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30 text-sm font-medium hover:bg-brand-500/25 transition-all"
              >
                Save
              </button>
              <button
                onClick={() => setShowNew(false)}
                className="px-4 py-2 rounded-xl text-sm text-dark-400 hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filter === "all"
              ? "bg-brand-500/20 text-brand-400"
              : "text-dark-500 hover:text-white"
          }`}
        >
          All ({ideas.length})
        </button>
        {PLATFORM_LIST.map((p) => {
          const n = ideas.filter((i) => i.platform === p.id).length;
          if (n === 0) return null;
          return (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === p.id
                  ? "bg-brand-500/20 text-brand-400"
                  : "text-dark-500 hover:text-white"
              }`}
            >
              {p.name} ({n})
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-dark-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="cai-card text-center py-12">
          <Lightbulb size={36} className="text-dark-700 mx-auto mb-3" />
          <p className="text-white font-semibold">No ideas yet</p>
          <p className="text-sm text-dark-500 mt-1">
            Generate a batch above, or add one manually.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((i) => {
            const tags = parseJSON<string[]>(i.tags, []);
            const plat = PLATFORMS[i.platform as PlatformId];
            return (
              <div
                key={i.id}
                className="cai-card hover:border-brand-500/30 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {plat ? (
                      <span className="cai-chip">
                        <plat.icon size={12} />
                        {plat.name}
                      </span>
                    ) : (
                      <span className="cai-chip">Any platform</span>
                    )}
                    {i.source === "ai" ? (
                      <span className="cai-chip border-brand-500/30 bg-brand-500/10 text-brand-400">
                        <Sparkles size={10} /> AI
                      </span>
                    ) : null}
                    <span className="cai-chip">
                      <Star size={10} /> {i.score}/10
                    </span>
                  </div>
                  <span className="text-[10px] text-dark-600 shrink-0">
                    {relativeTime(i.createdAt)}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{i.title}</h3>
                {i.hook ? (
                  <p className="text-sm text-dark-300 mb-2">"{i.hook}"</p>
                ) : null}
                {i.angle ? (
                  <p className="text-xs text-dark-500 mb-3">{i.angle}</p>
                ) : null}
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] text-dark-500 px-2 py-0.5 rounded-full bg-dark-800/40"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center gap-2 pt-3 border-t border-dark-800/50">
                  <button
                    onClick={() => promote(i.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-brand-500/15 text-brand-400 border border-brand-500/30 hover:bg-brand-500/25 transition-all flex items-center gap-1 font-medium"
                  >
                    <ArrowUpRight size={12} /> Promote to draft
                  </button>
                  <Link
                    href={`/studio?title=${encodeURIComponent(i.title)}&platform=${i.platform}`}
                    className="text-xs px-3 py-1.5 rounded-lg bg-dark-800/40 text-dark-400 hover:text-white transition-all flex items-center gap-1 font-medium"
                  >
                    <Wand2 size={12} /> Write it
                  </Link>
                  <button
                    onClick={() => archive(i.id)}
                    className="ml-auto text-xs p-1.5 rounded-lg text-dark-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
