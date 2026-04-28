"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  Check,
  Copy,
  ExternalLink,
  Plug,
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
