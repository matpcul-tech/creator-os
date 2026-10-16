// Autopilot state lives on the autopilot-state branch of the repo so log
// commits never trigger a Vercel deploy. Reads are public; writes (pause,
// run now) need GITHUB_AUTOPILOT_TOKEN, a fine-grained token with
// Contents and Actions read/write on this one repo.
export const AUTOPILOT_REPO = process.env.AUTOPILOT_REPO || "matpcul-tech/creator-os";
export const STATE_BRANCH = "autopilot-state";
export const WORKFLOW_FILE = "daily-autopilot.yml";

export type AutopilotConfig = { paused: boolean; time_central: string; privacy: string };
export type AutopilotLogEntry = {
  date: string; ts: string; trigger: string; dry_run: boolean; status: string;
  item?: string; angle?: string; title?: string; script?: string; url?: string; error?: string; reason?: string;
  duration_s?: number; ai_cost_usd?: number; note?: string;
};

const API = "https://api.github.com";

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const t = process.env.GITHUB_AUTOPILOT_TOKEN;
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export function canWrite(): boolean {
  return Boolean(process.env.GITHUB_AUTOPILOT_TOKEN);
}

async function readFile(path: string): Promise<{ text: string; sha: string } | null> {
  const res = await fetch(`${API}/repos/${AUTOPILOT_REPO}/contents/${path}?ref=${STATE_BRANCH}`, {
    headers: headers(), cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { content?: string; sha: string };
  return { text: Buffer.from(j.content || "", "base64").toString("utf8"), sha: j.sha };
}

export async function readState(): Promise<{ config: AutopilotConfig; log: AutopilotLogEntry[] }> {
  const [c, l] = await Promise.all([readFile("config.json"), readFile("log.json")]);
  const config = { paused: false, time_central: "11:30", privacy: "public", ...(c ? JSON.parse(c.text) : {}) };
  const log = l ? (JSON.parse(l.text) as AutopilotLogEntry[]) : [];
  return { config, log };
}

export async function setPaused(paused: boolean): Promise<void> {
  const cur = await readFile("config.json");
  const config = { time_central: "11:30", privacy: "public", ...(cur ? JSON.parse(cur.text) : {}), paused };
  const res = await fetch(`${API}/repos/${AUTOPILOT_REPO}/contents/config.json`, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: paused ? "autopilot: pause" : "autopilot: resume",
      content: Buffer.from(JSON.stringify(config, null, 2) + "\n").toString("base64"),
      branch: STATE_BRANCH,
      ...(cur ? { sha: cur.sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`GitHub refused the change (${res.status}).`);
}

export async function runNow(opts: { dryRun: boolean; force: boolean }): Promise<void> {
  const res = await fetch(`${API}/repos/${AUTOPILOT_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { dry_run: opts.dryRun, force: opts.force } }),
  });
  if (!res.ok) throw new Error(`GitHub refused the run (${res.status}).`);
}
