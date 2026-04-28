"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, Plus, X } from "lucide-react";
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

export default function AnalyticsPage() {
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [showForm, setShowForm] = useState(false);

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
            Manually-entered cross-platform stats. Snapshot your numbers weekly to see your trajectory.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all flex items-center gap-2"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Close" : "Add snapshot"}
        </button>
      </div>

      {showForm ? (
        <NewSnapshotForm
          onCreate={async (data) => {
            await fetch("/api/analytics", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            await load();
            setShowForm(false);
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
