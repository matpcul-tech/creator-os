"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  Shield,
  RefreshCw,
  Check,
  Sliders,
  Sparkles,
  Loader2,
  Save,
} from "lucide-react";

type VoiceAnalysis = {
  traits: { trait: string; strength: number }[];
  keywords: string[];
  voice_description: string;
  do_not_use: string[];
  example_good: string;
  example_bad: string;
};

type Profile = { voice?: string; name?: string };

export default function BrandPage() {
  const [profile, setProfile] = useState<Profile>({});
  const [samples, setSamples] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);

  const [primaryColor, setPrimaryColor] = useState("#7c3aed");
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [taglines, setTaglines] = useState<string[]>([]);
  const [taglineInput, setTaglineInput] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/brand").then((r) => r.json()),
    ]).then(([p, b]) => {
      setProfile(p);
      if (b.primaryColor) setPrimaryColor(b.primaryColor);
      if (b.accentColor) setAccentColor(b.accentColor);
      try {
        if (b.taglines) setTaglines(JSON.parse(b.taglines));
      } catch {}
    });
  }, []);

  async function analyze() {
    if (!samples || samples.length < 50) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/ai/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples }),
      });
      const json = await res.json();
      if (!json.error) {
        setAnalysis(json);
        setProfile((p) => ({ ...p, voice: json.voice_description }));
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveBrand() {
    await fetch("/api/brand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryColor, accentColor, taglines }),
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Brand DNA</h1>
          <p className="text-dark-400">
            Your voice profile drives every AI generation. Keep it sharp.
          </p>
        </div>
      </div>

      {/* Voice description */}
      <div className="cai-card">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={18} className="text-brand-400" />
          <h2 className="text-lg font-bold text-white">Your voice</h2>
        </div>
        <p className="text-sm text-dark-300 leading-relaxed">
          {profile.voice ||
            "Voice not configured yet. Paste samples below and let Claude analyze your style."}
        </p>
      </div>

      {/* Analyzer */}
      <div className="cai-card border-brand-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-brand-400" />
          <h2 className="text-lg font-bold text-white">Analyze writing samples</h2>
        </div>
        <p className="text-sm text-dark-400 mb-4">
          Paste 3–5 examples of your existing tweets, captions, or posts. Claude
          extracts your voice traits, keywords, and what NOT to write.
        </p>
        <textarea
          value={samples}
          onChange={(e) => setSamples(e.target.value)}
          placeholder={`---\nFirst sample\n---\nSecond sample\n---\nThird sample`}
          className="cai-input min-h-[180px] font-mono text-sm"
        />
        <button
          onClick={analyze}
          disabled={analyzing || samples.length < 50}
          className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-50 inline-flex items-center gap-2"
        >
          {analyzing ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Analyzing…
            </>
          ) : (
            <>
              <RefreshCw size={16} /> Analyze with Claude
            </>
          )}
        </button>
      </div>

      {/* Analysis output */}
      {analysis ? (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="cai-card">
              <div className="flex items-center gap-2 mb-5">
                <Sliders size={18} className="text-brand-400" />
                <h2 className="text-lg font-bold text-white">Voice traits</h2>
              </div>
              <div className="space-y-4">
                {analysis.traits.map((v) => (
                  <div key={v.trait}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-dark-300">{v.trait}</span>
                      <span className="text-sm font-medium text-white">{v.strength}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-dark-800/50">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-blue-500 transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, v.strength))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cai-card">
              <div className="flex items-center gap-2 mb-5">
                <Brain size={18} className="text-brand-400" />
                <h2 className="text-lg font-bold text-white">Brand keywords</h2>
              </div>
              <p className="text-sm text-dark-400 mb-4">
                Words and phrases AI associates with you:
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.keywords.map((k) => (
                  <span
                    key={k}
                    className="px-3 py-1.5 rounded-lg text-sm bg-brand-500/10 text-brand-400 border border-brand-500/20"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="cai-card">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-amber-400" />
              <h2 className="text-lg font-bold text-white">Avoid these phrases</h2>
            </div>
            <p className="text-sm text-dark-400 mb-3">
              These would make you sound generic. Claude will steer clear.
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.do_not_use.map((k) => (
                <span
                  key={k}
                  className="px-3 py-1.5 rounded-lg text-sm bg-red-500/10 text-red-300 border border-red-500/20 line-through"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>

          <div className="cai-card">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-brand-400" />
              <h2 className="text-lg font-bold text-white">Your voice vs. generic AI</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Check size={16} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-brand-400">Your voice</span>
                </div>
                <p className="text-sm text-dark-200 leading-relaxed italic">
                  &ldquo;{analysis.example_good}&rdquo;
                </p>
              </div>
              <div className="p-5 rounded-xl bg-dark-800/40 border border-dark-700/30">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-red-400 text-sm">✗</span>
                  <span className="text-sm font-semibold text-dark-400">Generic AI</span>
                </div>
                <p className="text-sm text-dark-300 leading-relaxed italic">
                  &ldquo;{analysis.example_bad}&rdquo;
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Brand kit */}
      <div className="cai-card">
        <h2 className="text-lg font-bold text-white mb-4">Brand kit</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-1.5 block">
                Primary color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-none"
                />
                <input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="cai-input flex-1 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-1.5 block">
                Accent color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-none"
                />
                <input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="cai-input flex-1 font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-1.5 block">
              Taglines / signature phrases
            </label>
            <div className="space-y-2">
              {taglines.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark-800/40 border border-dark-700/40"
                >
                  <span className="text-sm text-dark-200 flex-1">{t}</span>
                  <button
                    onClick={() => setTaglines(taglines.filter((_, j) => j !== i))}
                    className="text-xs text-dark-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={taglineInput}
                  onChange={(e) => setTaglineInput(e.target.value)}
                  placeholder="Add a phrase…"
                  className="cai-input flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && taglineInput.trim()) {
                      setTaglines([...taglines, taglineInput.trim()]);
                      setTaglineInput("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (taglineInput.trim()) {
                      setTaglines([...taglines, taglineInput.trim()]);
                      setTaglineInput("");
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-dark-800/40 text-sm text-dark-300 hover:text-white"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-5 mt-5 border-t border-dark-800/50">
          <button
            onClick={saveBrand}
            className="px-4 py-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/40 text-sm font-medium hover:bg-brand-500/30 transition-all flex items-center gap-2"
          >
            {savedFlash ? <Check size={14} /> : <Save size={14} />}
            {savedFlash ? "Saved" : "Save brand"}
          </button>
        </div>
      </div>
    </div>
  );
}
