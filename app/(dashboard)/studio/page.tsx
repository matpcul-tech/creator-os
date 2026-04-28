"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Wand2,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Save,
  Repeat,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  PLATFORMS,
  type PlatformId,
  PLATFORM_LIST,
} from "@/lib/platforms";

type Variants = Partial<Record<PlatformId, string>>;

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="text-dark-500 text-sm">Loading…</div>}>
      <StudioInner />
    </Suspense>
  );
}

function StudioInner() {
  const searchParams = useSearchParams();
  const initialTitle = searchParams.get("title") ?? "";
  const initialPlatform =
    (searchParams.get("platform") as PlatformId) ?? "youtube";

  const [title, setTitle] = useState(initialTitle);
  const [platform, setPlatform] = useState<PlatformId>(initialPlatform);
  const [context, setContext] = useState("");
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const [adaptTargets, setAdaptTargets] = useState<PlatformId[]>([]);
  const [variants, setVariants] = useState<Variants>({});
  const [adapting, setAdapting] = useState(false);

  useEffect(() => {
    if (initialTitle) {
      setTitle(initialTitle);
    }
  }, [initialTitle]);

  async function generate() {
    if (!title || generating) return;
    setGenerating(true);
    setDraft("");
    setVariants({});
    setSaved(false);
    try {
      const res = await fetch("/api/ai/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, platform, context }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text();
        setDraft(`[error: ${text}]`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        setDraft(buf);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setDraft((prev) => prev + `\n[error: ${msg}]`);
    } finally {
      setGenerating(false);
    }
  }

  async function adapt() {
    if (!draft || adaptTargets.length === 0 || adapting) return;
    setAdapting(true);
    try {
      const res = await fetch("/api/ai/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ master: draft, targets: adaptTargets }),
      });
      const json = await res.json();
      if (json.variants) setVariants(json.variants);
    } finally {
      setAdapting(false);
    }
  }

  async function saveDraft() {
    if (!title || !draft) return;
    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        status: "draft",
        platforms: [platform, ...adaptTargets],
        body: draft,
        variants,
      }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function toggleAdapt(p: PlatformId) {
    setAdaptTargets((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  const pCfg = PLATFORMS[platform];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Studio</h1>
        <p className="text-dark-400">
          Write once with Claude — then adapt it to every platform you post on.
        </p>
      </div>

      {/* Composer */}
      <div className="cai-card">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={18} className="text-brand-400" />
          <h2 className="text-lg font-bold text-white">Compose</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-dark-300 mb-1.5 block">
              Title or topic
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 10 things I'd tell my younger creator self"
              className="cai-input"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-dark-300 mb-2 block">
              Primary platform
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PLATFORM_LIST.map((p) => {
                const Icon = p.icon;
                const active = p.id === platform;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`p-3 rounded-xl text-left transition-all border ${
                      active
                        ? "bg-brand-500/15 border-brand-500/40"
                        : "bg-dark-800/30 border-dark-700/40 hover:border-dark-600"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={active ? "text-brand-400" : "text-dark-400"}
                    />
                    <p className="text-xs font-medium text-white mt-1.5">
                      {p.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-300 mb-1.5 block">
              Context (optional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Anything specific — references, sources, angles you want included, or examples to draw from"
              className="cai-input min-h-[80px]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-dark-500 max-w-md">
              <span className="font-semibold text-dark-300">Tip:</span>{" "}
              {pCfg.promptTips}
            </div>
            <Button onClick={generate} disabled={!title || generating}>
              {generating ? (
                <>
                  <RefreshCw size={16} className="animate-spin mr-2" />
                  Writing…
                </>
              ) : (
                <>
                  <Wand2 size={16} className="mr-2" />
                  Generate script
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Draft */}
      {draft || generating ? (
        <div className="cai-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Master draft</h2>
            <div className="flex gap-2">
              <button
                onClick={() => copy(draft)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800/40 text-dark-400 hover:text-white transition-all flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={saveDraft}
                disabled={!draft}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 transition-all flex items-center gap-1 disabled:opacity-50"
              >
                {saved ? (
                  <>
                    <Check size={12} /> Saved
                  </>
                ) : (
                  <>
                    <Save size={12} /> Save to planner
                  </>
                )}
              </button>
            </div>
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="cai-input min-h-[400px] font-mono text-sm leading-relaxed"
            placeholder="Your draft will stream here…"
          />

          <div className="mt-3 text-xs text-dark-500 flex items-center gap-3">
            <span>{draft.length} chars</span>
            <span>{draft.split(/\s+/).filter(Boolean).length} words</span>
          </div>
        </div>
      ) : null}

      {/* Adapter */}
      {draft ? (
        <div className="cai-card">
          <div className="flex items-center gap-2 mb-4">
            <Repeat size={18} className="text-brand-400" />
            <h2 className="text-lg font-bold text-white">
              Adapt to other platforms
            </h2>
          </div>
          <p className="text-sm text-dark-400 mb-4">
            Claude rewrites the master draft for each platform's native format —
            character limits, hashtags, hook style, all of it.
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {PLATFORM_LIST.filter((p) => p.id !== platform).map((p) => {
              const Icon = p.icon;
              const active = adaptTargets.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleAdapt(p.id)}
                  className={`p-3 rounded-xl text-left transition-all border ${
                    active
                      ? "bg-brand-500/15 border-brand-500/40"
                      : "bg-dark-800/30 border-dark-700/40 hover:border-dark-600"
                  }`}
                >
                  <Icon
                    size={16}
                    className={active ? "text-brand-400" : "text-dark-400"}
                  />
                  <p className="text-xs font-medium text-white mt-1">{p.name}</p>
                </button>
              );
            })}
          </div>

          <Button
            onClick={adapt}
            disabled={adapting || adaptTargets.length === 0}
            variant={adaptTargets.length === 0 ? "secondary" : "primary"}
          >
            {adapting ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" /> Adapting…
              </>
            ) : (
              <>
                <Wand2 size={16} className="mr-2" />
                Adapt for {adaptTargets.length || "0"} platform
                {adaptTargets.length === 1 ? "" : "s"}
              </>
            )}
          </Button>

          {Object.keys(variants).length > 0 ? (
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {Object.entries(variants).map(([id, content]) => {
                const p = PLATFORMS[id as PlatformId];
                if (!p) return null;
                const Icon = p.icon;
                return (
                  <div
                    key={id}
                    className="rounded-xl bg-dark-800/30 border border-dark-700/40 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-brand-400" />
                        <span className="text-sm font-semibold text-white">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-dark-500">
                          {(content ?? "").length}/{p.charLimit} chars
                        </span>
                      </div>
                      <button
                        onClick={() => copy(content ?? "")}
                        className="text-xs text-dark-400 hover:text-white"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap text-xs text-dark-200 leading-relaxed font-sans">
                      {content}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
