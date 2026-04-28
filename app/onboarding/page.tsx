"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PLATFORM_LIST } from "@/lib/platforms";

const STEPS = [
  { id: "identity", title: "Who are you?", desc: "Name, handle, and what you make." },
  { id: "audience", title: "Who's it for?", desc: "Pick your niche and ideal viewer." },
  { id: "platforms", title: "Where do you post?", desc: "Choose your active platforms." },
  { id: "voice", title: "How do you sound?", desc: "Optional — paste samples to extract your voice." },
  { id: "goals", title: "What's the goal?", desc: "Cadence and what 'winning' looks like." },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [form, setForm] = useState({
    name: "",
    handle: "",
    bio: "",
    niche: "",
    audience: "",
    platforms: [] as string[],
    voiceSamples: "",
    voice: "",
    weeklyCadence: 3,
    goals: "",
  });

  // Hydrate from existing profile if any
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        if (!p?.id) return;
        setForm((f) => ({
          ...f,
          name: p.name || f.name,
          handle: p.handle || f.handle,
          bio: p.bio || f.bio,
          niche: p.niche || f.niche,
          audience: p.audience || f.audience,
          platforms: (() => {
            try {
              return JSON.parse(p.platforms || "[]");
            } catch {
              return f.platforms;
            }
          })(),
          voice: p.voice || f.voice,
          weeklyCadence: p.weeklyCadence || f.weeklyCadence,
          goals: p.goals || f.goals,
        }));
      })
      .catch(() => {});
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));
  const togglePlatform = (id: string) =>
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(id)
        ? f.platforms.filter((p) => p !== id)
        : [...f.platforms, id],
    }));

  async function analyzeVoice() {
    if (!form.voiceSamples || form.voiceSamples.length < 50) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/ai/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: form.voiceSamples }),
      });
      const json = await res.json();
      if (json.voice_description) {
        setForm((f) => ({ ...f, voice: json.voice_description }));
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function finish() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          handle: form.handle,
          bio: form.bio,
          niche: form.niche,
          audience: form.audience,
          platforms: form.platforms,
          voice: form.voice,
          weeklyCadence: form.weeklyCadence,
          goals: form.goals,
          complete: true,
        }),
      });
      router.push("/dashboard");
    } catch (e) {
      setSaving(false);
    }
  }

  const current = STEPS[step];

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(124,58,237,0.15), #020617 70%)",
      }}
    >
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-white">
            Creator<span className="gradient-text">AI</span>
          </span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 max-w-md mx-auto">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= step ? "bg-gradient-to-r from-brand-500 to-blue-500" : "bg-dark-800"
              }`}
            />
          ))}
        </div>

        <div className="glass rounded-2xl p-8">
          <div className="text-xs text-brand-400 uppercase tracking-wider mb-2 font-semibold">
            Step {step + 1} of {STEPS.length}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{current.title}</h1>
          <p className="text-dark-400 text-sm mb-6">{current.desc}</p>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {current.id === "identity" && (
                <div className="space-y-4">
                  <Field label="Your name">
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Alex Rivera"
                      className="cai-input"
                    />
                  </Field>
                  <Field label="Handle (without @)">
                    <input
                      value={form.handle}
                      onChange={(e) => setForm({ ...form, handle: e.target.value })}
                      placeholder="alexrivera"
                      className="cai-input"
                    />
                  </Field>
                  <Field label="One-line bio">
                    <input
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      placeholder="Solo creator helping engineers build personal brands."
                      className="cai-input"
                    />
                  </Field>
                </div>
              )}

              {current.id === "audience" && (
                <div className="space-y-4">
                  <Field label="What's your niche?">
                    <input
                      value={form.niche}
                      onChange={(e) => setForm({ ...form, niche: e.target.value })}
                      placeholder="AI tools for solo creators"
                      className="cai-input"
                    />
                  </Field>
                  <Field label="Who's the ideal viewer?">
                    <textarea
                      value={form.audience}
                      onChange={(e) => setForm({ ...form, audience: e.target.value })}
                      placeholder="22–35 year-olds who already make some content but aren't yet making money from it."
                      className="cai-input min-h-[100px]"
                    />
                  </Field>
                </div>
              )}

              {current.id === "platforms" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PLATFORM_LIST.map((p) => {
                    const Icon = p.icon;
                    const active = form.platforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        className={`p-4 rounded-xl text-left transition-all border ${
                          active
                            ? "bg-brand-500/15 border-brand-500/40 text-white"
                            : "bg-dark-800/30 border-dark-700/40 text-dark-400 hover:border-dark-600 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={18} />
                          <span className="text-sm font-medium">{p.name}</span>
                          {active ? (
                            <Check size={14} className="text-brand-400 ml-auto" />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {current.id === "voice" && (
                <div className="space-y-4">
                  <Field
                    label="Paste 3–5 samples of your existing writing (tweets, captions, posts)"
                    hint="Optional but powerful — Claude will analyze your voice and configure the AI to write like you."
                  >
                    <textarea
                      value={form.voiceSamples}
                      onChange={(e) => setForm({ ...form, voiceSamples: e.target.value })}
                      placeholder={`---\nFirst sample\n---\nSecond sample\n---\nThird sample`}
                      className="cai-input min-h-[180px] font-mono text-sm"
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={analyzeVoice}
                    disabled={analyzing || !form.voiceSamples}
                    className="px-4 py-2 rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30 hover:bg-brand-500/25 transition-all text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Analyzing voice…
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> Analyze with Claude
                      </>
                    )}
                  </button>
                  {form.voice ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
                        <Check size={14} /> Voice extracted
                      </div>
                      <p className="text-sm text-dark-200">{form.voice}</p>
                    </div>
                  ) : (
                    <Field label="Or describe your voice in your own words">
                      <textarea
                        value={form.voice}
                        onChange={(e) => setForm({ ...form, voice: e.target.value })}
                        placeholder="Conversational, data-driven, slightly contrarian. No hype words."
                        className="cai-input min-h-[80px]"
                      />
                    </Field>
                  )}
                </div>
              )}

              {current.id === "goals" && (
                <div className="space-y-4">
                  <Field label="How many posts per week is your target?">
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 5, 7, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setForm({ ...form, weeklyCadence: n })}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                            form.weeklyCadence === n
                              ? "bg-brand-500/20 border-brand-500/40 text-white"
                              : "bg-dark-800/30 border-dark-700/40 text-dark-400 hover:text-white"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="What's the goal in the next 90 days?">
                    <textarea
                      value={form.goals}
                      onChange={(e) => setForm({ ...form, goals: e.target.value })}
                      placeholder="Hit 10K followers on X, ship one piece of content per weekday, land 2 sponsorships."
                      className="cai-input min-h-[100px]"
                    />
                  </Field>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-dark-800/50">
            <button
              type="button"
              onClick={prev}
              disabled={step === 0}
              className="text-sm text-dark-400 hover:text-white transition-colors disabled:opacity-30 inline-flex items-center gap-1"
            >
              <ArrowLeft size={16} /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Next <ArrowRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button onClick={finish} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-1" /> Saving…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="mr-1" /> Finish setup
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-dark-300 mb-1.5 block">{label}</label>
      {children}
      {hint ? <p className="text-xs text-dark-500 mt-1.5">{hint}</p> : null}
    </div>
  );
}
