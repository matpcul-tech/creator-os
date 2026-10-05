"use client";

import { useEffect, useState } from "react";
import { Bookmark, Check, Copy, ExternalLink, Film, Plug, Send, TrendingUp, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default function IntegrationsPage() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const bookmarklet = origin ? buildBookmarklet(origin) : "javascript:void(0)";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Integrations</h1>
        <p className="text-dark-400">Faceless workflow. No avatar, no cloned face.</p>
      </div>
      <div className="cai-card">
        <div className="flex items-center gap-2 mb-2">
          <Film size={18} className="text-brand-400" />
          <h2 className="text-lg font-bold text-white">Video — faceless only</h2>
        </div>
        <p className="text-sm text-dark-400">Talking-head avatars are off. Studio and Planner render caption cards, then you upload the file from Publish.</p>
        <a href="/studio" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-400">Open Studio <ExternalLink size={12} /></a>
      </div>
      <Section icon={Send} title="Publishing" body="Save a draft, then open the platform composer with the caption ready. Upload the faceless file there." link={{ href: "/studio", label: "Open Studio" }} />
      <div className="cai-card">
        <div className="flex items-center gap-2 mb-3"><Bookmark size={18} className="text-brand-400" /><h2 className="text-lg font-bold text-white">Capture bookmarklet</h2></div>
        <a href={bookmarklet} onClick={(e) => { e.preventDefault(); alert("Drag this to your bookmarks bar."); }} className="px-5 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold">Capture in CreatorAI</a>
        <button onClick={async () => { await navigator.clipboard.writeText(bookmarklet); setCopied(true); }} className="ml-3 px-3 py-2 rounded-xl text-sm">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
      </div>
      <Section icon={Upload} title="Bulk analytics" body="Drop a CSV on Analytics." link={{ href: "/analytics", label: "Open Analytics" }} />
      <Section icon={TrendingUp} title="Trend Radar" body="Reddit and Hacker News, matched to your niche." link={{ href: "/dashboard", label: "Open Dashboard" }} />
      <div className="cai-card border-amber-500/20">
        <div className="flex items-center gap-2 mb-2"><Plug size={18} className="text-amber-400" /><h2 className="text-lg font-bold text-white">Platform APIs are not connected</h2></div>
        <p className="text-sm text-dark-400">Posting still opens the composer. It does not auto-post.</p>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, body, link }: { icon: LucideIcon; title: string; body: string; link: { href: string; label: string } }) {
  return (
    <div className="cai-card">
      <div className="flex items-center gap-2 mb-2"><Icon size={18} className="text-brand-400" /><h2 className="text-lg font-bold text-white">{title}</h2></div>
      <p className="text-sm text-dark-400">{body}</p>
      <a href={link.href} className="mt-3 inline-flex items-center gap-1 text-sm text-brand-400">{link.label} <ExternalLink size={12} /></a>
    </div>
  );
}

function buildBookmarklet(origin: string): string {
  const code = `(function(){var u=encodeURIComponent(window.location.href);window.open('${origin}/analytics?capture='+u,'_blank');})();`;
  return "javascript:" + encodeURIComponent(code);
}
