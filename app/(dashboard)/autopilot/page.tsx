"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Entry = {
  date: string; ts: string; status: string; trigger: string; dry_run: boolean;
  item?: string; angle?: string; title?: string; url?: string; error?: string; reason?: string; duration_s?: number;
};
type Status = {
  config: { paused: boolean; time_central: string; privacy: string } | null;
  log: Entry[]; canWrite: boolean; repo: string;
  items: { id: string; title: string; kind: string; link: string }[];
};

export default function AutopilotPage() {
  const [s, setS] = useState<Status | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tok, setTok] = useState<{ refreshToken: string; clientId: string; account: string } | null>(null);
  const [copied, setCopied] = useState("");

  async function load() {
    const r = await fetch("/api/autopilot/status", { cache: "no-store" });
    setS(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function control(action: "pause" | "resume" | "run", dryRun = false) {
    setBusy(true); setMsg("");
    const r = await fetch("/api/autopilot/control", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, dryRun, force: action === "run" }),
    });
    const j = await r.json();
    setMsg(j.ok ? (action === "run" ? "Run started. It takes about 5 to 10 minutes; refresh the log after." : "Saved.") : j.error);
    setBusy(false); load();
  }

  async function reveal() {
    const r = await fetch("/api/autopilot/token", { method: "POST" });
    const j = await r.json();
    if (j.error) setMsg(j.error); else setTok(j);
  }
  async function copy(label: string, v: string) {
    await navigator.clipboard.writeText(v).catch(() => {});
    setCopied(label); setTimeout(() => setCopied(""), 1500);
  }

  const actions = s ? `https://github.com/${s.repo}/actions/workflows/daily-autopilot.yml` : "#";
  const secrets = s ? `https://github.com/${s.repo}/settings/secrets/actions` : "#";
  const paused = s?.config?.paused;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Daily autopilot</h1>
        <p className="text-sm text-muted-foreground">
          Every day at {s?.config?.time_central ?? "11:30"} AM Central, one vertical Short about a book or game is written,
          voiced, rendered, and posted to Red Sky Archive as a {s?.config?.privacy ?? "public"} Short. Runs on GitHub Actions.
        </p>
      </div>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm ${paused ? "bg-yellow-500/20 text-yellow-300" : "bg-green-500/20 text-green-300"}`}>
            {s ? (paused ? "Paused" : "On") : "Loading"}
          </span>
          <Button disabled={busy || !s?.canWrite} onClick={() => control(paused ? "resume" : "pause")}>
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button disabled={busy || !s?.canWrite} onClick={() => control("run")}>Run now</Button>
          <Button variant="secondary" disabled={busy || !s?.canWrite} onClick={() => control("run", true)}>Test render (no upload)</Button>
          <a className="text-sm underline" href={actions} target="_blank" rel="noreferrer">Open in GitHub</a>
        </div>
        {!s?.canWrite && s && (
          <p className="text-sm text-muted-foreground">
            To use these buttons here, add <code>GITHUB_AUTOPILOT_TOKEN</code> in Vercel (see setup). Until then use
            Run workflow on the GitHub page.
          </p>
        )}
        {msg && <p className="text-sm">{msg}</p>}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Connect YouTube for autopilot</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Finish the Google Cloud setup in docs/autopilot-setup.md.</li>
          <li>Go to <a className="underline" href="/integrations">Integrations</a>, click Connect YouTube, pick the Red Sky Archive channel, click Allow.</li>
          <li>Come back here, click Show token, and paste each value into <a className="underline" href={secrets} target="_blank" rel="noreferrer">GitHub secrets</a>.</li>
        </ol>
        <Button variant="secondary" onClick={reveal}>Show token</Button>
        {tok && (
          <div className="space-y-2 text-sm">
            <p>Account: {tok.account || "connected"}. Treat these like passwords.</p>
            {[["YT_REFRESH_TOKEN", tok.refreshToken], ["YT_CLIENT_ID", tok.clientId]].map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <code className="w-44">{k}</code>
                <code className="flex-1 truncate">{v ? v.slice(0, 6) + "..." + v.slice(-4) : "(not set)"}</code>
                <Button size="sm" variant="secondary" onClick={() => copy(k, v)}>{copied === k ? "Copied" : "Copy"}</Button>
              </div>
            ))}
            <p className="text-muted-foreground">YT_CLIENT_SECRET is the client secret from Google Cloud (the same one in Vercel).</p>
          </div>
        )}
      </Card>

      <Card className="space-y-2 p-5">
        <h2 className="font-semibold">Rotation</h2>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {s?.items.map((i) => (
            <li key={i.id}><a className="underline" href={i.link} target="_blank" rel="noreferrer">{i.title}</a> <span className="text-muted-foreground">({i.kind})</span></li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Run log</h2>
        {!s?.log.length && <p className="text-sm text-muted-foreground">No runs yet.</p>}
        <ul className="space-y-2 text-sm">
          {s?.log.map((e, i) => (
            <li key={i} className="border-b border-white/5 pb-2">
              <span className="font-medium">{e.date}</span> {e.status}{e.dry_run ? " (test)" : ""} {e.item ? `· ${e.item} · ${e.angle}` : ""}
              {e.title && <div>{e.title}</div>}
              {e.url && <a className="underline" href={e.url} target="_blank" rel="noreferrer">{e.url}</a>}
              {(e.error || e.reason) && <div className="text-red-300">{e.error || e.reason}</div>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
