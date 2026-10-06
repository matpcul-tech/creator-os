"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wand2, Sparkles, RefreshCw, Copy, Check, Save, Repeat, Loader2, Send, Film } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PLATFORMS, type PlatformId, PLATFORM_LIST } from "@/lib/platforms";
import { PublishPanel } from "@/components/PublishPanel";
import { PictorySend } from "@/components/PictorySend";

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
  const initialPlatform = (searchParams.get("platform") as PlatformId) ?? "youtube";
  const [title, setTitle] = useState(initialTitle);
  const [platform, setPlatform] = useState<PlatformId>(initialPlatform);
  const [context, setContext] = useState("Faceless. No on-camera person. Write for a Pictory stock-and-voice video.");
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adaptTargets, setAdaptTargets] = useState<PlatformId[]>([]);
  const [variants, setVariants] = useState<Variants>({});
  const [adapting, setAdapting] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);

  useEffect(() => { if (initialTitle) setTitle(initialTitle); }, [initialTitle]);

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
        body: JSON.stringify({ title, platform, context: `${context}\n\nHard rule: faceless. No host, face, or avatar. Write spoken lines Pictory can turn into stock scenes.` }),
      });
      if (!res.ok || !res.body) { setDraft(`[error: ${await res.text()}]`); return; }
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
      setDraft((prev) => prev + `\n[error: ${e instanceof Error ? e.message : String(e)}]`);
    } finally {
      setGenerating(false);
    }
  }

  async function adapt() {
    if (!draft || adaptTargets.length === 0 || adapting) return;
    setAdapting(true);
    try {
      const res = await fetch("/api/ai/adapt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ master: draft, targets: adaptTargets }) });
      const json = await res.json();
      if (json.variants) setVariants(json.variants);
    } finally { setAdapting(false); }
  }

  async function saveDraft() {
    if (!title || !draft) return;
    const res = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, status: "draft", platforms: [platform, ...adaptTargets], body: draft, variants }) });
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

  const pCfg = PLATFORMS[platform];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Studio</h1>
        <p className="text-dark-400">Write the faceless script here. Pictory makes the stock-and-voice video.</p>
      </div>
      <div className="cai-card">
        <div className="flex items-center gap-2 mb-5"><Sparkles size={18} className="text-brand-400" /><h2 className="text-lg font-bold text-white">Compose</h2></div>
        <div className="space-y-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title or topic" className="cai-input" />
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PLATFORM_LIST.map((p) => {
              const Icon = p.icon;
              const active = p.id === platform;
              return (
                <button key={p.id} onClick={() => setPlatform(p.id)} className={`p-3 rounded-xl text-left border ${active ? "bg-brand-500/15 border-brand-500/40" : "bg-dark-800/30 border-dark-700/40"}`}>
                  <Icon size={18} className={active ? "text-brand-400" : "text-dark-400"} />
                  <p className="text-xs font-medium text-white mt-1.5">{p.name}</p>
                </button>
              );
            })}
          </div>
          <textarea value={context} onChange={(e) => setContext(e.target.value)} className="cai-input min-h-[80px]" />
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-dark-500 max-w-md">{pCfg.promptTips}</p>
            <Button onClick={generate} disabled={!title || generating}>{generating ? <><RefreshCw size={16} className="animate-spin mr-2" />Writing…</> : <><Wand2 size={16} className="mr-2" />Generate script</>}</Button>
          </div>
        </div>
      </div>
      {draft || generating ? (
        <div className="cai-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Master draft</h2>
            <div className="flex gap-2">
              <button onClick={() => copy(draft)} className="px-3 py-1.5 rounded-lg text-xs bg-dark-800/40 text-dark-300">{copied ? <Check size={12} /> : <Copy size={12} />} Copy</button>
              <button onClick={saveDraft} disabled={!draft} className="px-3 py-1.5 rounded-lg text-xs bg-brand-500/15 text-brand-400">{saved ? "Saved" : <><Save size={12} /> Save</>}</button>
            </div>
          </div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="cai-input min-h-[320px] font-mono text-sm" />
        </div>
      ) : null}
      {draft ? (
        <div className="cai-card">
          <div className="flex items-center gap-2 mb-2"><Film size={18} className="text-brand-400" /><h2 className="text-lg font-bold text-white">Pictory video</h2></div>
          <PictorySend title={title} script={draft} />
        </div>
      ) : null}
      {draft ? (
        <div className="cai-card">
          <div className="flex items-center gap-2 mb-4"><Repeat size={18} className="text-brand-400" /><h2 className="text-lg font-bold text-white">Adapt</h2></div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {PLATFORM_LIST.filter((p) => p.id !== platform).map((p) => {
              const Icon = p.icon;
              const active = adaptTargets.includes(p.id);
              return <button key={p.id} onClick={() => setAdaptTargets((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])} className={`p-3 rounded-xl border ${active ? "border-brand-500/40 text-brand-400" : "border-dark-700/40 text-dark-400"}`}><Icon size={16} /><p className="text-xs mt-1">{p.name}</p></button>;
            })}
          </div>
          <Button onClick={adapt} disabled={adapting || adaptTargets.length === 0}>{adapting ? <Loader2 size={16} className="animate-spin" /> : <><Wand2 size={16} className="mr-2" />Adapt</>}</Button>
        </div>
      ) : null}
      {draft && savedId ? (
        <div className="cai-card">
          <div className="flex items-center gap-2 mb-4"><Send size={18} className="text-brand-400" /><h2 className="text-lg font-bold text-white">Publish</h2></div>
          <PublishPanel contentId={savedId} title={title} body={draft} variants={variants} platforms={[platform, ...adaptTargets]} />
        </div>
      ) : null}
    </div>
  );
}
