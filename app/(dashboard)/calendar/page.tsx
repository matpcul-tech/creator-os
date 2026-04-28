"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar as CalIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { parseJSON } from "@/lib/utils";

type Piece = {
  id: number;
  title: string;
  status: string;
  platforms: string;
  scheduledAt: string | null;
  publishedAt: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    fetch("/api/content")
      .then((r) => r.json())
      .then(setPieces);
  }, []);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0,
  ).getDate();

  const cells: { date: Date | null; pieces: Piece[] }[] = useMemo(() => {
    const out: { date: Date | null; pieces: Piece[] }[] = [];
    for (let i = 0; i < startWeekday; i++) out.push({ date: null, pieces: [] });
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      const dayPieces = pieces.filter((p) => {
        const at = p.scheduledAt || p.publishedAt;
        if (!at) return false;
        const ad = new Date(at);
        return (
          ad.getFullYear() === d.getFullYear() &&
          ad.getMonth() === d.getMonth() &&
          ad.getDate() === d.getDate()
        );
      });
      out.push({ date: d, pieces: dayPieces });
    }
    while (out.length % 7 !== 0) out.push({ date: null, pieces: [] });
    return out;
  }, [cursor, pieces, startWeekday, daysInMonth]);

  function nav(delta: number) {
    setCursor(
      new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1),
    );
  }

  function isToday(d: Date) {
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  const upcoming = pieces
    .filter(
      (p) =>
        p.scheduledAt && new Date(p.scheduledAt).getTime() >= Date.now(),
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
    )
    .slice(0, 6);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Calendar</h1>
          <p className="text-dark-400">
            Every piece you've scheduled, plotted on a month grid.
          </p>
        </div>
        <Link
          href="/planner"
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all flex items-center gap-2"
        >
          <Plus size={16} /> Add in planner
        </Link>
      </div>

      <div className="cai-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => nav(-1)}
              className="p-2 rounded-lg hover:bg-dark-800/50 text-dark-400 hover:text-white transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-xl font-bold text-white">{monthLabel}</h2>
            <button
              onClick={() => nav(1)}
              className="p-2 rounded-lg hover:bg-dark-800/50 text-dark-400 hover:text-white transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <button
            onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-dark-400 hover:text-white hover:bg-dark-800/40 transition-all"
          >
            Today
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {DAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-semibold text-dark-500 uppercase tracking-wider py-1"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cells.map((cell, idx) => (
            <div
              key={idx}
              className={`min-h-[110px] rounded-xl p-2 border transition-all ${
                cell.date
                  ? cell.date && isToday(cell.date)
                    ? "bg-brand-500/10 border-brand-500/30"
                    : "bg-dark-800/30 border-dark-700/30 hover:border-dark-600"
                  : "border-transparent"
              }`}
            >
              {cell.date ? (
                <>
                  <div className="text-xs font-semibold text-dark-400 mb-1.5">
                    {cell.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {cell.pieces.slice(0, 3).map((p) => {
                      const plats = parseJSON<string[]>(p.platforms, []);
                      const color =
                        p.status === "published"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/30";
                      return (
                        <Link
                          key={p.id}
                          href={`/planner?id=${p.id}`}
                          className={`block px-2 py-1 rounded text-[10px] font-medium border ${color} hover:scale-[1.02] transition-transform`}
                        >
                          <div className="line-clamp-1">{p.title}</div>
                          <div className="flex gap-0.5 opacity-70 mt-0.5">
                            {plats.slice(0, 3).map((pl) => {
                              const Icon = PLATFORMS[pl as PlatformId]?.icon;
                              return Icon ? <Icon key={pl} size={9} /> : null;
                            })}
                          </div>
                        </Link>
                      );
                    })}
                    {cell.pieces.length > 3 ? (
                      <div className="text-[10px] text-dark-500">
                        +{cell.pieces.length - 3} more
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="cai-card">
        <h2 className="text-lg font-bold text-white mb-4">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="text-center py-6">
            <CalIcon size={28} className="text-dark-700 mx-auto mb-2" />
            <p className="text-sm text-dark-500">
              Nothing scheduled. Open the planner and assign a date to a draft.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl bg-dark-800/30 border border-dark-700/30"
              >
                <div>
                  <p className="text-sm font-medium text-white">{p.title}</p>
                  <p className="text-xs text-dark-500 mt-0.5">
                    {new Date(p.scheduledAt!).toLocaleString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <Link
                  href={`/planner?id=${p.id}`}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
