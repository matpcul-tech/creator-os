"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  Plus,
  X,
  Upload,
  Link as LinkIcon,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { PLATFORMS, type PlatformId, PLATFORM_LIST } from "@/lib/platforms";
import { formatNumber } from "@/lib/utils";

type Snap = {
  id: number;
  contentId: number | null;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followers: number;
  capturedAt: string;
};

type Mode = "manual" | "csv" | "url" | null;

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="text-dark-500 text-sm">Loading…</div>}>
      <AnalyticsInner />
    </Suspense>
  );
}

function AnalyticsInner() {
  const searchParams = useSearchParams();
  const captureParam = searchParams.get("capture");
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [mode, setMode] = useState<Mode>(captureParam ? "url" : null);

  async function load() {
    const data = await (await fetch("/api/analytics")).json();
    setSnaps(data);
  }

  useEffect(() => {
    load();
  }, []);

  const byPlatform = useMemo(() => {
    const map = new Map<string, Snap>();
    for (const s of snaps) {
      const ex = map.get(s.platform);
      if (!ex || new Date(s.capturedAt) > new Date(ex.capturedAt)) {
        map.set(s.platform, s);
      }
    }
    return Array.from(map.values());
  }, [snaps]);

  const totalFollowers = byPlatform.reduce((acc, s) => acc + s.followers, 0);
  const totalViews = snaps.reduce((acc, s) => acc + s.views, 0);
  const totalLikes = snaps.reduce((acc, s) => acc + s.likes, 0);
  const avgEngagement = snaps.length
    ? Math.round(
        (snaps.reduce((acc, s) => {
          if (!s.views) return acc;
          return acc + ((s.likes + s.comments + s.shares) / s.views) * 100;
        }, 0) /
          snaps.length) *
          10,
      ) / 10
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Analytics</h1>
          <p className="text-dark-400">
            Drop in a CSV, paste a post URL, or punch in numbers manually.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMode(mode === "csv" ? null : "csv")}
            className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${
              mode === "csv"
                ? "bg-brand-500/15 border-brand-500/40 text-brand-300"
                : "glass hover:border-brand-500/30"
            }`}
          >
            <Upload size={16} /> Import CSV
          </button>
          <button
            onClick={() => setMode(mode === "url" ? null : "url")}
            className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${
              mode === "url"
                ? "bg-brand-500/15 border-brand-500/40 text-brand-300"
                : "glass hover:border-brand-500/30"
            }`}
          >
            <LinkIcon size={16} /> Capture URL
          </button>
          <button
            onClick={() => setMode(mode === "manual" ? null : "manual")}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all flex items-center gap-2"
          >
            {mode === "manual" ? <X size={16} /> : <Plus size={16} />}
            {mode === "manual" ? "Close" : "Add snapshot"}
          </button>
        </div>
      </div>

      {mode === "csv" ? <CsvImportForm onDone={load} /> : null}
      {mode === "url" ? (
        <UrlCaptureForm onDone={load} initialUrl={captureParam ?? ""} />
      ) : null}

      {mode === "manual" ? (
        <NewSnapshotForm
          onCreate={async (data) => {
            await fetch("/api/analytics", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            await load();
            setMode(null);
          }}
        />
      ) : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total followers" value={formatNumber(totalFollowers)} />
        <SummaryCard label="Total views" value={formatNumber(totalViews)} />
        <SummaryCard label="Total likes" value={formatNumber(totalLikes)} />
        <SummaryCard label="Avg engagement" value={`${avgEngagement}%`} />
      </div>

      <div className="cai-card">
        <h2 className="text-lg font-bold text-white mb-5">Platform snapshot</h2>
        {byPlatform.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 size={36} className="text-dark-700 mx-auto mb-3" />
            <p className="text-white font-semibold">No data yet</p>
            <p className="text-sm text-dark-500 mt-1">
              Add your first snapshot to track your numbers over time.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {byPlatform.map((s) => {
              const plat = PLATFORMS[s.platform as PlatformId];
              if (!plat) return null;
              const Icon = plat.icon;
              const eng = s.views
                ? ((s.likes + s.comments + s.shares) / s.views) * 100
                : 0;
              return (
                <div
                  key={s.id}
                  className="rounded-2xl bg-dark-800/30 border border-dark-700/40 p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-3 h-3 rounded-full ${plat.dotColor}`} />
                    <Icon size={14} className="text-dark-400" />
                    <span className="text-sm font-medium text-dark-300">{plat.name}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatNumber(s.followers)}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-dark-500">{formatNumber(s.views)} views</span>
                    <span className="text-xs text-emerald-400 font-medium">
                      {eng.toFixed(1)}% eng
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {snaps.length > 0 ? (
        <div className="cai-card">
          <h2 className="text-lg font-bold text-white mb-5">Snapshot history</h2>
          <div className="space-y-1">
            <div className="grid grid-cols-7 gap-3 px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-dark-500">
              <span className="col-span-2">When</span>
              <span>Platform</span>
              <span className="text-right">Followers</span>
              <span className="text-right">Views</span>
              <span className="text-right">Likes</span>
              <span className="text-right">Comments</span>
            </div>
            {snaps.slice(0, 30).map((s) => {
              const plat = PLATFORMS[s.platform as PlatformId];
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-7 gap-3 px-3 py-2 rounded-xl text-sm hover:bg-dark-800/40 transition-all items-center"
                >
                  <span className="col-span-2 text-dark-400 text-xs">
                    {new Date(s.capturedAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-dark-300 text-xs flex items-center gap-1.5">
                    {plat ? <plat.icon size={12} /> : null}
                    {plat?.name ?? s.platform}
                  </span>
                  <span className="text-right">{formatNumber(s.followers)}</span>
                  <span className="text-right text-dark-300">{formatNumber(s.views)}</span>
                  <span className="text-right text-dark-300">{formatNumber(s.likes)}</span>
                  <span className="text-right text-dark-300">{formatNumber(s.comments)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="cai-card">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-dark-500 mt-1 flex items-center gap-1">
        <ArrowUpRight size={10} className="text-emerald-400" />
        {label}
      </p>
    </div>
  );
}

function NewSnapshotForm({
  onCreate,
}: {
  onCreate: (d: {
    platform: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    followers: number;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    platform: "x" as PlatformId,
    followers: 0,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
  });

  return (
    <div className="cai-card">
      <h3 className="text-base font-bold text-white mb-3">New snapshot</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-dark-500 mb-1 block">Platform</label>
          <select
            value={form.platform}
            onChange={(e) =>
              setForm({ ...form, platform: e.target.value as PlatformId })
            }
            className="cai-input"
          >
            {PLATFORM_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {(
          ["followers", "views", "likes", "comments", "shares", "saves"] as const
        ).map((k) => (
          <div key={k}>
            <label className="text-xs text-dark-500 mb-1 block capitalize">{k}</label>
            <input
              type="number"
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
              className="cai-input"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => onCreate(form)}
        className="mt-3 px-4 py-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/40 text-sm font-medium hover:bg-brand-500/30 transition-all"
      >
        Save snapshot
      </button>
    </div>
  );
}

function CsvImportForm({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [platform, setPlatform] = useState<PlatformId>("youtube");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; imported: number; skipped: number; matched: string[] }
    | { ok: false; message: string }
    | null
  >(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function submit() {
    if (!csv) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/analytics/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, platform }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({
          ok: true,
          imported: json.imported,
          skipped: json.skipped,
          matched: json.matchedColumns,
        });
        onDone();
      } else {
        setResult({ ok: false, message: json.error ?? `HTTP ${res.status}` });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cai-card">
      <h3 className="text-base font-bold text-white mb-1">Import analytics CSV</h3>
      <p className="text-sm text-dark-400 mb-4">
        Paste a CSV or drop a file. Recognizable columns:{" "}
        <code className="text-dark-300">views, likes, comments, shares, saves, followers</code>
        {" "}(also: impressions, reposts, hearts, subscribers, bookmarks).
        Works with YouTube Studio &amp; X analytics exports.
      </p>

      <div className="grid sm:grid-cols-[200px_1fr] gap-3 mb-3">
        <div>
          <label className="text-xs text-dark-500 mb-1 block">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as PlatformId)}
            className="cai-input"
          >
            {PLATFORM_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-dark-500 mb-1 block">Pick a file</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onPickFile}
            className="cai-input file:mr-3 file:bg-brand-500/15 file:text-brand-300 file:border-0 file:rounded-md file:px-3 file:py-1 file:cursor-pointer"
          />
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="rounded-xl border border-dashed border-dark-700/60 bg-dark-900/40 p-3"
      >
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={"Paste CSV here, or drop a file on this area.\n\nExample:\nviews,likes,comments,shares\n1240,89,12,4\n3120,210,33,11"}
          className="w-full min-h-[160px] bg-transparent border-0 outline-none text-xs font-mono text-dark-200 placeholder:text-dark-600"
        />
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={submit}
          disabled={busy || !csv}
          className="px-4 py-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/40 text-sm font-medium hover:bg-brand-500/30 transition-all disabled:opacity-50 inline-flex items-center gap-2"
        >
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Importing…
            </>
          ) : (
            <>Import</>
          )}
        </button>

        {result?.ok ? (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <Check size={14} /> Imported {result.imported} · skipped{" "}
            {result.skipped} · matched [{result.matched.join(", ")}]
          </span>
        ) : null}
        {result && !result.ok ? (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={14} /> {result.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function UrlCaptureForm({
  onDone,
  initialUrl = "",
}: {
  onDone: () => void;
  initialUrl?: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [stats, setStats] = useState({
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    followers: 0,
  });
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<
    | { platform: string; oembed: { title: string | null; author: string | null } | null }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!url) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, stats }),
      });
      const json = await res.json();
      if (res.ok) {
        setInfo({ platform: json.platform, oembed: json.oembed });
        onDone();
      } else {
        setError(json.error ?? `HTTP ${res.status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cai-card">
      <h3 className="text-base font-bold text-white mb-1">Capture from URL</h3>
      <p className="text-sm text-dark-400 mb-4">
        Paste the URL of a tweet, YouTube video, TikTok, or post. We&apos;ll
        detect the platform and (where possible) pull the title via oEmbed.
        Add the engagement numbers below — they&apos;re saved as a snapshot.
      </p>

      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://x.com/.../status/..., https://youtube.com/watch?v=..., etc."
        className="cai-input mb-3"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        {(["views", "likes", "comments", "shares", "saves", "followers"] as const).map((k) => (
          <div key={k}>
            <label className="text-xs text-dark-500 mb-1 block capitalize">{k}</label>
            <input
              type="number"
              value={stats[k]}
              onChange={(e) => setStats({ ...stats, [k]: Number(e.target.value) })}
              className="cai-input"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy || !url}
          className="px-4 py-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/40 text-sm font-medium hover:bg-brand-500/30 transition-all disabled:opacity-50 inline-flex items-center gap-2"
        >
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Saving…
            </>
          ) : (
            <>Save snapshot</>
          )}
        </button>
        {info ? (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <Check size={14} /> Saved as {info.platform}
            {info.oembed?.title ? ` · "${info.oembed.title}"` : ""}
          </span>
        ) : null}
        {error ? (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={14} /> {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
