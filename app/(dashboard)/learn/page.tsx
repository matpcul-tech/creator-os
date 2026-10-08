import Link from "next/link";
import { GraduationCap, Lightbulb, BarChart3 } from "lucide-react";

// Learn used to show sample courses with fake progress and made-up "AI tips".
// None of it was backed by data, so it now shows honest empty states until
// real analytics exist.
export default function LearnPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Learn</h1>
        <p className="text-dark-400">Tips based on how your own videos perform.</p>
      </div>

      <div className="glass rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
          <Lightbulb size={22} className="text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">No tips yet</h2>
        <p className="text-sm text-dark-400 max-w-md mx-auto mb-5">
          Tips will appear once you have analytics data. Add a few published posts and their numbers, and we&apos;ll point out what&apos;s working.
        </p>
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500/15 px-4 py-2 text-sm font-medium text-brand-300 hover:bg-brand-500/25 transition-colors"
        >
          <BarChart3 size={16} /> Go to Analytics
        </Link>
      </div>

      <div className="glass rounded-2xl p-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
          <GraduationCap size={20} className="text-brand-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white mb-1">Lessons are not available yet</h2>
          <p className="text-sm text-dark-400">We&apos;re not offering courses right now. This space will hold short guides when they&apos;re ready.</p>
        </div>
      </div>
    </div>
  );
}
