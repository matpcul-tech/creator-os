"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Lock, CheckCircle2, ChevronRight } from "lucide-react";

const DAYS = [
  { day: "1–3", title: "Format lock", detail: "Set one-sentence format, voice, and thumbnail style. No new formats after this." },
  { day: "4–10", title: "First 5 videos", detail: "Hook in first 20 seconds. One clear takeaway. Hard rule check before publish." },
  { day: "11–30", title: "Cadence lock", detail: "2 long-form + 3 Shorts per week. Analytics review required before next script." },
];

export default function LearnPage() {
  const [completed, setCompleted] = useState<string[]>([]);

  function mark(day: string) {
    setCompleted((prev) => (prev.includes(day) ? prev : [...prev, day]));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">30-Day Path</h1>
        <p className="text-dark-400">Locked progression from first video to consistent output. Format cannot drift.</p>
      </div>

      <div className="space-y-4">
        {DAYS.map((item) => {
          const done = completed.includes(item.day);
          return (
            <div key={item.day} className="glass rounded-2xl p-6 flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
                {done ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Lock size={20} className="text-brand-400" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-bold text-white">Days {item.day}: {item.title}</h2>
                  {done && <span className="text-xs text-emerald-400">Complete</span>}
                </div>
                <p className="text-sm text-dark-400 mb-3">{item.detail}</p>
                {!done && (
                  <button
                    onClick={() => mark(item.day)}
                    className="inline-flex items-center gap-1 text-sm text-brand-300 hover:text-brand-200"
                  >
                    Mark complete <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap size={18} className="text-brand-400" />
          <h2 className="text-base font-bold text-white">Next</h2>
        </div>
        <p className="text-sm text-dark-400 mb-4">
          Once the format is locked, every Studio script must pass the hook and takeaway check before it can be saved or produced.
        </p>
        <Link href="/studio" className="inline-flex items-center gap-2 rounded-xl bg-brand-500/15 px-4 py-2 text-sm font-medium text-brand-300 hover:bg-brand-500/25 transition-colors">
          Go to Studio
        </Link>
      </div>
    </div>
  );
}
