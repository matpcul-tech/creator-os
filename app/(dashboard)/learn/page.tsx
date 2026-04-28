"use client";

import { GraduationCap, Play, Clock, CheckCircle2, Lock, Star, TrendingUp } from "lucide-react";

const courses = [
  { title: "Brand Voice Mastery", lessons: 8, duration: "45 min", progress: 100, level: "Beginner", tag: "Completed" },
  { title: "Content Repurposing Blueprint", lessons: 6, duration: "35 min", progress: 60, level: "Beginner", tag: "In Progress" },
  { title: "Twitter/X Growth Engine", lessons: 10, duration: "1.2 hrs", progress: 0, level: "Intermediate", tag: null },
  { title: "Instagram Reels That Convert", lessons: 8, duration: "55 min", progress: 0, level: "Intermediate", tag: null },
  { title: "Monetization From Day 1", lessons: 12, duration: "1.5 hrs", progress: 0, level: "Advanced", tag: "Popular" },
  { title: "Building a Newsletter Empire", lessons: 7, duration: "50 min", progress: 0, level: "Advanced", tag: null },
];

const dailyTips = [
  "Your listicle posts get 3.2x more engagement — try another one today.",
  "Tuesday afternoon is your highest-engagement window. Schedule accordingly.",
  "Your Brand DNA shows you underuse storytelling — try a personal anecdote in your next post.",
];

export default function LearnPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Creator Academy</h1>
        <p className="text-dark-400">Personalized learning path based on your goals and current skill level.</p>
      </div>

      {/* Progress Summary */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Your Learning Path</h2>
          <span className="text-sm text-dark-400">1 of 6 courses completed</span>
        </div>
        <div className="h-3 rounded-full bg-dark-800/50 mb-2">
          <div className="h-3 rounded-full bg-gradient-to-r from-brand-500 to-blue-500" style={{ width: "17%" }} />
        </div>
        <p className="text-xs text-dark-500">Personalized based on your niche, experience level, and growth goals</p>
      </div>

      {/* Daily Tips */}
      <div className="glass rounded-2xl p-6 border-amber-500/20">
        <h2 className="text-lg font-bold text-white mb-3">💡 Today&apos;s AI Tips For You</h2>
        <div className="space-y-2">
          {dailyTips.map((tip, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-dark-300">
              <Star size={14} className="text-amber-400 mt-1 shrink-0" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c) => (
          <div key={c.title} className="glass rounded-2xl p-5 hover:border-brand-500/20 transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.level === "Beginner" ? "bg-emerald-500/10 text-emerald-400" : c.level === "Intermediate" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}>{c.level}</span>
              {c.tag && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.tag === "Completed" ? "bg-emerald-500/10 text-emerald-400" : c.tag === "In Progress" ? "bg-amber-500/10 text-amber-400" : "bg-brand-500/10 text-brand-400"}`}>{c.tag}</span>
              )}
            </div>
            <h3 className="text-white font-bold mb-2 group-hover:text-brand-400 transition-colors">{c.title}</h3>
            <div className="flex items-center gap-3 text-xs text-dark-500 mb-4">
              <span className="flex items-center gap-1"><Play size={12} />{c.lessons} lessons</span>
              <span className="flex items-center gap-1"><Clock size={12} />{c.duration}</span>
            </div>
            {c.progress > 0 && (
              <div>
                <div className="h-1.5 rounded-full bg-dark-800/50">
                  <div className={`h-1.5 rounded-full ${c.progress === 100 ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${c.progress}%` }} />
                </div>
                <p className="text-[10px] text-dark-500 mt-1">{c.progress}% complete</p>
              </div>
            )}
            {c.progress === 0 && (
              <button className="w-full py-2 rounded-lg text-sm text-brand-400 border border-brand-500/20 hover:bg-brand-500/10 transition-all">Start Course</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
