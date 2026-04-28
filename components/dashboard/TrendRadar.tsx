"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Flame, Loader2, RefreshCw, Wand2 } from "lucide-react";

type Trend = {
  source: "reddit" | "hn";
  title: string;
  url: string;
  score: number;
  comments: number;
  subreddit?: string;
  author?: string;
  age: string;
};

export function TrendRadar() {
  const [items, setItems] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(force = false) {
    if (force) setRefreshing(true);
    try {
      const res = await fetch(`/api/trends${force ? "?refresh=1" : ""}`);
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      setItems(json.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  return (
    <div className="cai-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame size={18} className="text-amber-400" />
          <h2 className="text-lg font-bold text-white">Trend Radar</h2>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-xs text-dark-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          {refreshing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          Refresh
        </button>
      </div>
      <p className="text-xs text-dark-500 mb-4">
        Live from Reddit and Hacker News, scoped to your niche.
      </p>
      {loading ? (
        <div className="text-sm text-dark-500">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-400">Failed to load trends: {error}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-dark-500">No trends right now.</div>
      ) : (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {items.slice(0, 10).map((t) => (
            <li
              key={t.url}
              className="rounded-xl bg-dark-800/30 border border-dark-700/30 p-3 hover:border-brand-500/30 transition-all group"
            >
              <div className="flex items-start gap-2">
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium text-white line-clamp-2 group-hover:text-brand-400 transition-colors">
                    {t.title}
                  </p>
                  <div className="text-[10px] text-dark-500 mt-1 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-dark-800/60">
                      {t.source === "reddit" ? `r/${t.subreddit}` : "HN"}
                    </span>
                    <span>↑ {t.score.toLocaleString()}</span>
                    <span>{t.comments.toLocaleString()} comments</span>
                    <span>{t.age}</span>
                  </div>
                </a>
                <Link
                  href={`/ideas?topic=${encodeURIComponent(t.title)}`}
                  className="shrink-0 p-1.5 rounded-lg bg-dark-800/40 text-dark-400 hover:text-brand-400 hover:bg-brand-500/10 transition-all opacity-0 group-hover:opacity-100"
                  title="Generate ideas from this"
                >
                  <Wand2 size={12} />
                </Link>
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1.5 rounded-lg bg-dark-800/40 text-dark-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
