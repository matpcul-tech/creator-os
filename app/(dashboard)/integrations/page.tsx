"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  Check,
  Copy,
  ExternalLink,
  Film,
  Loader2,
  Plug,
  Save,
  Send,
  TrendingUp,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default function IntegrationsPage() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const bookmarklet = origin
    ? buildBookmarklet(origin)
    : "javascript:void(0)";

  async function copyBookmarklet() {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Integrations</h1>
        <p className="text-dark-400">
          Wire CreatorAI into your existing workflow without API keys.
        </p>
      </div>

      <Section
        icon={Send}
        title="Publishing — web intents"
        body="Click 'Mark as published' on any draft and we route the text to the platform's native composer. X is one-click pre-fill. Other platforms (LinkedIn / Threads / TikTok / IG / YouTube) copy the text and open the platform's compose page."
        link={{ href: "/studio", label: "Open the Studio" }}
      />

      <div className="cai-card">
        <div className="flex items-center gap-2 mb-3">
          <Bookmark size={18} className="text-brand-400" />
          <h2 className="text-lg font-bold text-white">Capture bookmarklet</h2>
        </div>
        <p className="text-sm text-dark-400 mb-3">
          Drag this button to your bookmarks bar. When you&apos;re viewing your
          own tweet / YouTube / TikTok / IG post, click the bookmarklet and it
          opens CreatorAI&apos;s capture form with the URL pre-filled — you
          fill in the numbers and save.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <a
            href={bookmarklet}
            onClick={(e) => {
              e.preventDefault();
              alert(
                "Drag this button to your bookmarks bar. Don't click it on this page.",
              );
            }}
            draggable
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold cursor-move shadow-lg shadow-brand-500/25 select-none"
          >
            📊 Capture in CreatorAI
          </a>
          <button
            onClick={copyBookmarklet}
            className="px-3 py-2 rounded-xl glass text-sm hover:border-brand-500/30 transition-all flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-400" /> Copied
              </>
            ) : (
              <>
                <Copy size={14} /> Copy code
              </>
            )}
          </button>
        </div>

        <details className="text-xs text-dark-500">
          <summary className="cursor-pointer hover:text-dark-300 transition-colors">
            View bookmarklet source
          </summary>
          <pre className="mt-2 p-3 rounded-lg bg-dark-900/60 border border-dark-700/40 overflow-x-auto whitespace-pre-wrap break-all">
            {bookmarklet}
          </pre>
        </details>
      </div>

      <HeyGenConnect />

      <Section
        icon={Upload}
        title="Bulk analytics — CSV import"
        body="Export 'Content' or 'Reach' from YouTube Studio (or any analytics dashboard with views/likes/comments columns) and drop the CSV onto Analytics. Each row becomes a snapshot."
        link={{ href: "/analytics", label: "Open Analytics" }}
      />

      <Section
        icon={TrendingUp}
        title="Trend Radar — Reddit + Hacker News"
        body="Live trend feed pulled from Reddit (subreddits matched to your niche) and Hacker News front page. Click the wand icon on any trend to generate ideas in your voice."
        link={{ href: "/dashboard", label: "Open Dashboard" }}
      />

      <div className="cai-card border-amber-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Plug size={18} className="text-amber-400" />
          <h2 className="text-lg font-bold text-white">Real platform APIs (next)</h2>
        </div>
        <p className="text-sm text-dark-400">
          These wire up direct OAuth + posting + analytics fetching. Ask Claude
          to add them when you&apos;re ready — they need API keys you set up.
        </p>
        <div className="mt-4 grid sm:grid-cols-2 gap-2">
          {[
            ["X (Twitter) v2", "Direct posting + impressions"],
            ["YouTube Data API", "Auto-refresh views/subs nightly"],
            ["LinkedIn Marketing", "Post + impressions"],
            ["Substack", "Cross-post to your newsletter"],
            ["Threads (Meta)", "Post via Graph API"],
            ["Buffer / Hypefury", "Use as a publishing backend"],
          ].map(([name, what]) => (
            <div
              key={name}
              className="flex items-start gap-2 px-3 py-2 rounded-lg bg-dark-800/30 border border-dark-700/40"
            >
              <span className="w-1.5 h-1.5 mt-2 rounded-full bg-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">{name}</p>
                <p className="text-xs text-dark-500">{what}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  body,
  link,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  link: { href: string; label: string };
}) {
  return (
    <div className="cai-card">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className="text-brand-400" />
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      <p className="text-sm text-dark-400">{body}</p>
      <a
        href={link.href}
        className="mt-3 inline-flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300"
      >
        {link.label} <ExternalLink size={12} />
      </a>
    </div>
  );
}

type Avatar = { id: string; name: string; previewUrl: string };
type Voice = { id: string; name: string; language: string };

function HeyGenConnect() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/heygen");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || `HeyGen ${res.status}`);
          return;
        }
        setAvatars(json.avatars ?? []);
        setVoices(json.voices ?? []);
        setAvatarId(json.selected?.avatarId ?? "");
        setVoiceId(json.selected?.voiceId ?? "");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (saving || !avatarId || !voiceId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/heygen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId, voiceId }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cai-card">
      <div className="flex items-center gap-2 mb-2">
        <Film size={18} className="text-brand-400" />
        <h2 className="text-lg font-bold text-white">HeyGen — talking-head video</h2>
      </div>
      <p className="text-sm text-dark-400">
        Render any script as a video of your cloned digital twin speaking in
        your own voice. Set <code className="text-xs text-brand-300">HEYGEN_API_KEY</code> in
        your environment, then pick your avatar + voice below.
      </p>
      <a
        href="https://app.heygen.com"
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
      >
        Open HeyGen dashboard <ExternalLink size={11} />
      </a>

      <div className="mt-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-dark-400">
            <Loader2 size={14} className="animate-spin" />
            Loading your avatars and voices…
          </div>
        ) : error ? (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-2 block">
                Avatar
              </label>
              {avatars.length === 0 ? (
                <p className="text-xs text-dark-500">
                  No avatars on your HeyGen account yet. Create one in the
                  HeyGen dashboard, then refresh.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[280px] overflow-y-auto pr-1">
                  {avatars.map((a) => {
                    const active = a.id === avatarId;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setAvatarId(a.id)}
                        className={`group rounded-xl overflow-hidden border text-left transition-all ${
                          active
                            ? "border-brand-500/60 ring-2 ring-brand-500/30"
                            : "border-dark-700/40 hover:border-dark-600"
                        }`}
                      >
                        {a.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.previewUrl}
                            alt={a.name}
                            className="w-full aspect-[3/4] object-cover bg-dark-800"
                          />
                        ) : (
                          <div className="w-full aspect-[3/4] bg-dark-800 flex items-center justify-center">
                            <Film size={20} className="text-dark-600" />
                          </div>
                        )}
                        <div className="px-2 py-1.5 bg-dark-900/60">
                          <p className="text-xs font-medium text-white truncate">
                            {a.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-2 block">
                Voice
              </label>
              {voices.length === 0 ? (
                <p className="text-xs text-dark-500">
                  No voices available. Clone your voice in the HeyGen dashboard.
                </p>
              ) : (
                <select
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  className="cai-input"
                >
                  <option value="">Select a voice…</option>
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.language ? ` — ${v.language}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={save}
                disabled={!avatarId || !voiceId || saving}
                className="px-4 py-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/40 text-sm font-medium hover:bg-brand-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saved ? (
                  <>
                    <Check size={14} /> Saved
                  </>
                ) : saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save selection
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Builds a bookmarklet that detects the current page's platform from its URL,
// then opens our /analytics page in capture mode with the URL pre-filled.
function buildBookmarklet(origin: string): string {
  const code = `
    (function(){
      var u = encodeURIComponent(window.location.href);
      window.open('${origin}/analytics?capture=' + u, '_blank');
    })();
  `;
  return "javascript:" + encodeURIComponent(code.replace(/\s+/g, " ").trim());
}
