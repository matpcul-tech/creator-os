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
  Send,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  PLATFORMS,
  type PlatformId,
  PLATFORM_LIST,
} from "@/lib/platforms";
import { PublishPanel } from "@/components/PublishPanel";
import { FacelessCut } from "@/components/FacelessCut";
import { PictorySend } from "@/components/PictorySend";
import { shapeScript } from "@/lib/cut/direct";
import { joinContinuation, readStream } from "@/lib/stream-protocol";

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
  const [savedId, setSavedId] = useState<number | null>(null);
  const [aiError, setAiError] = useState("");
  // Set when a script stream stopped before the end, so the user can Continue.
  const [stopped, setStopped] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");
  // Angle suggestions for short or broad titles.
  const [angles, setAngles] = useState<string[]>([]);
  const [anglesFor, setAnglesFor] = useState("");
  const [anglesLoading, setAnglesLoading] = useState(false);
  const [angleNote, setAngleNote] = useState("");

  useEffect(() => {
    if (initialTitle) setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (generating || !draft) return;
    const long = draft.split(/\n+/).some((line) => line.trim().split(/\s+/).length > 16);
    const dashed = /[\u2012\u2013\u2014\u2015]|--|\s-\s/.test(draft);
    if (!long && !dashed) return;
    const shaped = shapeScript(draft);
    if (shaped !== draft) setDraft(shaped);
  }, [draft, generating]);

  // A one or two word title ("Longevity science") is broad, and the script
  // tends to drift. Offer 3 specific angles first.
  const titleWords = title.trim().split(/\s+/).filter(Boolean).length;
  const thinTitle = title.trim().length > 0 && (titleWords < 3 || title.trim().length < 12);

  function clearAngles() {
    setAngles([]);
    setAnglesFor("");
  }

  async function generate() {
    const t = title.trim();
    if (!t || generating || anglesLoading) return;
    setAiError("");
    setAngleNote("");
    if (!thinTitle) return writeScript(t);

    clearAngles();
    setAnglesLoading(true);
    try {
      const res = await fetch("/api/ai/angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, platform, context }),
      });
      const json = (await res.json().catch(() => ({}))) as { angles?: string[] };
      if (res.ok && json.angles?.length) {
        setAngles(json.angles);
        setAnglesFor(t);
        return;
      }
    } catch {
      // fall through to writing from the original title
    } finally {
      setAnglesLoading(false);
    }
    setAngleNote("Angle ideas aren't available right now, so we're writing from your title.");
    await writeScript(t);
  }

  function pickAngle(angle: string) {
    setTitle(angle);
    clearAngles();
    writeScript(angle);
  }

  function keepTitleAsIs() {
    const t = anglesFor || title.trim();
    clearAngles();
    writeScript(t);
  }

  async function writeScript(scriptTitle: string, partial = "") {
    if (!scriptTitle || generating) return;
    setAiError("");
    setStopped("");
    setGenerating(true);
    if (!partial) {
      setDraft("");
      setVariants({});
      setSaved(false);
    }
    setScriptTitle(scriptTitle);
    const base = partial.trimEnd();
    let shown = base;
    try {
      const res = await fetch("/api/ai/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scriptTitle,
          platform,
          context: `${context}\n\nHard rule: faceless video. One short sentence per line. A blank line between lines. No em dashes, no en dashes, and no hyphens used as dashes. Use a period. No markdown, no headings, no asterisks, no captions.`,
          ...(base ? { partial: base } : {}),
        }),
      });
      if (!res.ok || !res.body) {
        const raw = await res.text();
        let msg = "Something went wrong writing the script. Please try again.";
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          if (parsed.error) msg = parsed.error;
        } catch {
          // keep the generic message
        }
        if (base) setStopped(msg);
        else setAiError(msg);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let state = readStream("");
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          state = readStream(buf);
          shown = base ? joinContinuation(base, state.text) : state.text;
          setDraft(shown);
        }
      } catch {
        // The connection dropped mid stream. What arrived is kept below.
      }
      state = readStream(buf);
      shown = base ? joinContinuation(base, state.text) : state.text;
      setDraft(shapeScript(shown));
      if (state.error) setStopped(state.error);
      else if (!state.done) setStopped("The connection dropped before the script finished. Press Continue to finish it.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (shown) {
        setDraft(shapeScript(shown));
        setStopped("The connection dropped before the script finished. Press Continue to finish it.");
      } else {
        setAiError(msg || "Something went wrong writing the script. Please try again.");
      }
    } finally {
      setGenerating(false);
    }
  }

  function continueScript() {
    if (!draft.trim()) return;
    writeScript(scriptTitle || title, draft);
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
      const piece = await res.json();
      setSavedId(piece.id);
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
          Faceless by default. Write the script, then play it with a voice, captions, and a file you can post.
        </p>
      </div>

      <div className="cai-card">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={18} className="text-brand-400" />
          <h2 className="text-lg font-bold text-white">Compose</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-dark-300 mb-1.5 block">Title or topic</label>
            <input value={title} onChange={(e) => { setTitle(e.target.value); clearAngles(); }} placeholder="e.g. the 90-second rule for starting hard work" className="cai-input" />
          </div>
          <div>
            <label className="text-sm font-medium text-dark-300 mb-2 block">Primary platform</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PLATFORM_LIST.map((p) => {
                const Icon = p.icon;
                const active = p.id === platform;
                return (
                  <button key={p.id} onClick={() => setPlatform(p.id)} className={`p-3 rounded-xl text-left transition-all border ${active ? "bg-brand-500/15 border-brand-500/40" : "bg-dark-800/30 border-dark-700/40 hover:border-dark-600"}`}>
                    <Icon size={18} className={active ? "text-brand-400" : "text-dark-400"} />
                    <p className="text-xs font-medium text-white mt-1.5">{p.name}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label htmlFor="studio-context" className="text-sm font-medium text-dark-300 mb-1 block">Context</label>
            <p className="text-xs text-dark-500 mb-1.5">Optional: audience, key points, tone.</p>
            <textarea
              id="studio-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="For example: busy parents, 3 quick tips, warm and direct."
              className="cai-input min-h-[80px]"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-dark-500 max-w-md">
              <span className="font-semibold text-dark-300">Tip:</span> {pCfg.promptTips}
            </div>
            <Button onClick={() => generate()} disabled={!title.trim() || generating || anglesLoading}>
              {anglesLoading ? <><RefreshCw size={16} className="animate-spin mr-2" />Finding angles...</> : generating ? <><RefreshCw size={16} className="animate-spin mr-2" />Writing…</> : <><Wand2 size={16} className="mr-2" />Generate faceless script</>}
            </Button>
          </div>
        </div>
      </div>

      {anglesLoading ? (
        <div role="status" className="cai-card flex items-center gap-3 text-sm text-dark-300">
          <RefreshCw size={16} className="animate-spin text-brand-400" />
          Finding sharper angles for &quot;{title.trim()}&quot;...
        </div>
      ) : null}

      {angles.length > 0 ? (
        <div className="cai-card">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-brand-400" />
            <h2 className="text-base font-bold text-white">Pick an angle</h2>
          </div>
          <p className="text-sm text-dark-400 mb-4">
            &quot;{anglesFor}&quot; is broad. Tap one to write it now.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {angles.map((angle) => (
              <button
                key={angle}
                onClick={() => pickAngle(angle)}
                className="text-left rounded-xl border border-dark-700/50 bg-dark-800/40 p-4 hover:border-brand-500/50 hover:bg-brand-500/10 transition-all"
              >
                <span className="block text-sm font-semibold text-white leading-snug">{angle}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-brand-300">
                  <Wand2 size={12} /> Write this
                </span>
              </button>
            ))}
          </div>
          <button onClick={keepTitleAsIs} className="mt-3 text-xs text-dark-400 hover:text-white underline underline-offset-2">
            Use my title as is
          </button>
        </div>
      ) : null}

      {angleNote ? (
        <div role="status" className="rounded-xl border border-dark-700/50 bg-dark-800/40 p-3 text-sm text-dark-300">
          {angleNote}
        </div>
      ) : null}

      {aiError ? (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {aiError}
        </div>
      ) : null}

      {stopped && !generating ? (
        <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100 flex flex-wrap items-center justify-between gap-3">
          <span>{stopped}</span>
          <button
            type="button"
            onClick={continueScript}
            disabled={!draft.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-100 hover:bg-amber-500/30 transition-all disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      ) : null}

      {draft || generating ? (
        <div className="cai-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Master draft</h2>
            <div className="flex gap-2">
              <button onClick={() => copy(draft)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800/40 text-dark-400 hover:text-white transition-all flex items-center gap-1">
                {copied ? <><Check size={12} className="text-emerald-400" />Copied</> : <><Copy size={12} />Copy</>}
              </button>
              <button onClick={saveDraft} disabled={!draft} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 transition-all flex items-center gap-1 disabled:opacity-50">
                {saved ? <><Check size={12} /> Saved</> : <><Save size={12} /> Save to planner</>}
              </button>
            </div>
          </div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="cai-input min-h-[400px] font-mono text-sm leading-relaxed" placeholder="Your draft will stream here…" />
          <div className="mt-3 text-xs text-dark-500 flex items-center gap-3">
            <span>{draft.length} chars</span>
            <span>{draft.split(/\s+/).filter(Boolean).length} words</span>
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="cai-card">
          <div className="flex items-center gap-2 mb-4">
            <Repeat size={18} className="text-brand-400" />
            <h2 className="text-lg font-bold text-white">Adapt to other platforms</h2>
          </div>
          <p className="text-sm text-dark-400 mb-4">Rewrites the faceless script for each platform. Still no on-camera person.</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {PLATFORM_LIST.filter((p) => p.id !== platform).map((p) => {
              const Icon = p.icon;
              const active = adaptTargets.includes(p.id);
              return (
                <button key={p.id} onClick={() => toggleAdapt(p.id)} className={`p-3 rounded-xl text-left transition-all border ${active ? "bg-brand-500/15 border-brand-500/40" : "bg-dark-800/30 border-dark-700/40 hover:border-dark-600"}`}>
                  <Icon size={16} className={active ? "text-brand-400" : "text-dark-400"} />
                  <p className="text-xs font-medium text-white mt-1">{p.name}</p>
                </button>
              );
            })}
          </div>
          <Button onClick={adapt} disabled={adapting || adaptTargets.length === 0} variant={adaptTargets.length === 0 ? "secondary" : "primary"}>
            {adapting ? <><Loader2 size={16} className="animate-spin mr-2" />Adapting…</> : <><Wand2 size={16} className="mr-2" />Adapt for {adaptTargets.length || "0"} platform{adaptTargets.length === 1 ? "" : "s"}</>}
          </Button>
          {Object.keys(variants).length > 0 ? (
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {Object.entries(variants).map(([id, content]) => {
                const p = PLATFORMS[id as PlatformId];
                if (!p) return null;
                const Icon = p.icon;
                return (
                  <div key={id} className="rounded-xl bg-dark-800/30 border border-dark-700/40 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-brand-400" />
                        <span className="text-sm font-semibold text-white">{p.name}</span>
                        <span className="text-[10px] text-dark-500">{(content ?? "").length}/{p.charLimit} chars</span>
                      </div>
                      <button onClick={() => copy(content ?? "")} className="text-xs text-dark-400 hover:text-white">Copy</button>
                    </div>
                    <pre className="whitespace-pre-wrap text-xs text-dark-200 leading-relaxed font-sans">{content}</pre>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {draft && !generating ? (
        <div className="cai-card">
          <div className="flex items-center gap-2 mb-4">
            <Film size={18} className="text-brand-400" />
            <h2 className="text-lg font-bold text-white">Video and voice</h2>
          </div>
          <FacelessCut script={draft} title={title} />
        </div>
      ) : null}

      {draft && !generating ? (
        <div className="cai-card">
          <div className="flex items-center gap-2 mb-4">
            <Film size={18} className="text-brand-400" />
            <h2 className="text-lg font-bold text-white">Pictory video</h2>
          </div>
          <PictorySend title={title} script={draft} />
        </div>
      ) : null}

      {draft ? (
        <div className="cai-card">
          <div className="flex items-center gap-2 mb-4">
            <Send size={18} className="text-brand-400" />
            <h2 className="text-lg font-bold text-white">Publish</h2>
          </div>
          {!savedId ? (
            <p className="text-sm text-dark-400">Save the draft first, then open each platform composer with the caption ready. Upload the faceless file there.</p>
          ) : (
            <PublishPanel contentId={savedId} title={title} body={draft} variants={variants} platforms={[platform, ...adaptTargets]} />
          )}
        </div>
      ) : null}
    </div>
  );
}
