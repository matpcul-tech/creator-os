"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Send } from "lucide-react";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { buildIntent } from "@/lib/intents";
import { parseJSON } from "@/lib/utils";

type Variants = Partial<Record<PlatformId, string>>;

export function PublishPanel({
  contentId,
  title,
  body,
  variants,
  platforms,
  publishUrls,
  onPublished,
}: {
  contentId: number | null;
  title: string;
  body: string;
  variants?: Variants | string;
  platforms: PlatformId[];
  publishUrls?: Record<string, string> | string;
  onPublished?: (urls: Record<string, string>) => void;
}) {
  const parsedVariants: Variants =
    typeof variants === "string" ? parseJSON<Variants>(variants, {}) : variants ?? {};
  const initialUrls: Record<string, string> =
    typeof publishUrls === "string"
      ? parseJSON<Record<string, string>>(publishUrls, {})
      : publishUrls ?? {};

  const [openedAt, setOpenedAt] = useState<Record<string, number>>({});
  const [copiedAt, setCopiedAt] = useState<Record<string, number>>({});
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  function textFor(p: PlatformId): string {
    return parsedVariants[p] || body || title;
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAt({ ...copiedAt, [key]: Date.now() });
      setTimeout(() => {
        setCopiedAt((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 1500);
    } catch {}
  }

  async function go(p: PlatformId) {
    const intent = buildIntent(p, textFor(p));
    if (intent.mode === "intent") {
      window.open(intent.url, "_blank", "noopener,noreferrer");
    } else {
      await copy(intent.text, p);
      if (intent.url) {
        window.open(intent.url, "_blank", "noopener,noreferrer");
      }
    }
    setOpenedAt({ ...openedAt, [p]: Date.now() });
  }

  async function markPublished() {
    if (!contentId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content/${contentId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (res.ok) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
        onPublished?.(urls);
      }
    } finally {
      setSaving(false);
    }
  }

  if (platforms.length === 0) {
    return (
      <div className="text-sm text-dark-500 italic">
        Pick at least one platform to publish to.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {platforms.map((p) => {
          const plat = PLATFORMS[p];
          if (!plat) return null;
          const Icon = plat.icon;
          const intent = buildIntent(p, textFor(p));
          const justCopied = copiedAt[p];
          const wasOpened = openedAt[p];

          return (
            <div
              key={p}
              className="rounded-xl bg-dark-800/30 border border-dark-700/40 p-4"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Icon size={16} className="text-dark-300" />
                  <span className="text-sm font-semibold text-white">{plat.name}</span>
                  {intent.mode === "intent" ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      One-click
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      Copy + open
                    </span>
                  )}
                  {wasOpened ? (
                    <span className="text-[10px] text-dark-500">opened</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copy(intent.text, p)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-dark-800/60 text-dark-300 hover:text-white transition-all flex items-center gap-1"
                    title="Copy text only"
                  >
                    {justCopied ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => go(p)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-600 to-blue-600 text-white hover:shadow-lg hover:shadow-brand-500/25 transition-all flex items-center gap-1"
                  >
                    <ExternalLink size={12} />
                    {intent.label}
                  </button>
                </div>
              </div>
              <p className="text-xs text-dark-500 mb-2">{intent.hint}</p>
              <input
                value={urls[p] ?? ""}
                onChange={(e) => setUrls({ ...urls, [p]: e.target.value })}
                placeholder="Paste live URL after posting…"
                className="w-full px-3 py-2 rounded-lg text-xs bg-dark-900/60 border border-dark-700 text-white placeholder:text-dark-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              />
            </div>
          );
        })}
      </div>

      {contentId ? (
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-dark-800/50">
          <button
            onClick={markPublished}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-sm font-medium hover:bg-emerald-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving…
              </>
            ) : savedFlash ? (
              <>
                <Check size={14} /> Marked as published
              </>
            ) : (
              <>
                <Send size={14} /> Mark as published
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
