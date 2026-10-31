// Turns a long visual description into the cards that should appear while that
// scene is spoken. One still for a whole minute of narration is too generic.

import type { CaptionCue } from "@/lib/produce/captions";

export type BeatKind =
  | "cds"
  | "gpu"
  | "flow"
  | "stat"
  | "bars"
  | "table"
  | "note"
  | "stack"
  | "loop"
  | "waffle"
  | "split"
  | "quote"
  | "chain"
  | "compare"
  | "ledger"
  | "steps"
  | "list"
  | "url"
  | "generic";

export type Beat = {
  kind: BeatKind;
  title: string;
  quotes: string[];
  body: string;
  source: string;
  /** Checklist lines visible so far. 0 is the title only. */
  reveal?: number;
  /** 0 acquired, 1 restructured, 2 default. The rented provider box cycles these. */
  providerState?: number;
};

export function quotesOf(text: string): string[] {
  const out: string[] = [];
  const re = /"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) out.push(match[1].trim());
  return out.filter(Boolean);
}

function sourceOf(visual: string): string {
  const match = visual.match(/Source tag:\s*([^|]+)/i);
  return match?.[1]?.trim() || "";
}

function kindFor(text: string): BeatKind {
  const lower = text.toLowerCase();
  const named = text.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || "";
  if (named.includes("step")) return "steps";
  if (named.includes("stacked")) return "stack";
  if (named.includes("waffle")) return "waffle";
  if (named.includes("before")) return "compare";
  if (named.includes("ledger") || named.includes("two-column")) return "ledger";
  if (named.includes("checklist")) return "list";
  if (named.includes("end card")) return "url";
  if (named.includes("quote")) return "quote";
  if (named.includes("table")) return "table";
  if (named.includes("loop")) return "loop";
  if (named.includes("three-way")) return "split";
  if (named.includes("chain")) return "chain";
  if (named.includes("flow") || named.includes("definition")) return "flow";
  if (named.includes("bar")) return "bars";
  if (named.includes("stat") || named.includes("caution") || named.includes("counter") || named.includes("term") || named.includes("side")) return named.includes("caution") || named.includes("counter") || named.includes("term") || named.includes("side") ? "note" : "stat";
  if (/caution/.test(lower)) return "note";
  if (/end card|sovereignshieldtechnologies\.com/.test(lower) && /nothing else|centered/.test(lower)) return "url";
  if (/padlock|lien\?/.test(lower)) return "gpu";
  if (/question mark|flat gpu server icon/.test(lower)) return "gpu";
  if (/cds spread|distress line|line chart/.test(lower)) return "cds";
  if (/waffle/.test(lower)) return "waffle";
  if (/stacked bar/.test(lower)) return "stack";
  if (/loop diagram|new debt/.test(lower)) return "loop";
  if (/before\/after|rented/.test(lower) && /owned/.test(lower)) return "compare";
  if (/two-column|ledger|removed by owning/.test(lower)) return "ledger";
  if (/step chart|node 1/.test(lower)) return "steps";
  if (/checklist/.test(lower)) return "list";
  if (/three-way|acquisition/.test(lower) && /partnership/.test(lower)) return "split";
  if (/quote card|guppy-level/.test(lower)) return "quote";
  if (/counterpoint|jensen/.test(lower)) return "note";
  if (/term sheet|364-day/.test(lower)) return "note";
  if (/caution/.test(lower)) return "note";
  if (/table card|october 2026/.test(lower) && /rows/.test(lower)) return "table";
  if (/bar chart|two bars|market value/.test(lower)) return "bars";
  if (/stat card|15\.78%|giant/.test(lower)) return "stat";
  if (/chain diagram|lenders/.test(lower) && /you|neocloud|provider/.test(lower)) return "chain";
  if (/flow diagram|definition card|three boxes|delayed draw|borrow/.test(lower)) return "flow";
  if (/side card|nebius:/.test(lower)) return "note";
  return "generic";
}

function titleFor(text: string, fallback: string): string {
  const quoted = quotesOf(text);
  const named = text.match(/title[:\s]+"([^"]+)"/i)?.[1];
  if (named) return named;
  if (/what a neocloud/i.test(text)) return "What a neocloud is";
  if (/delayed draw/i.test(text)) return "Delayed draw term loan";
  if (/q2 2026/i.test(text)) return "Q2 2026, $ millions";
  if (/market value/i.test(text)) return "Market value, CoreWeave";
  if (/october 2026/i.test(text) && /rows/i.test(text)) return "October 2026";
  if (/coreweave debt/i.test(text)) return "CoreWeave debt, June 30, 2026";
  if (/gartner/i.test(text) && /80/.test(text)) return "Gartner: over 80% cease independent operations by 2030";
  if (/15\.78/.test(text)) return quoted[0] || "CoreWeave 2031 notes";
  if (quoted[0] && quoted[0].length < 60) return quoted[0];
  return fallback;
}

export function beatsFromVisual(visual: string, fallbackTitle: string): Beat[] {
  const source = sourceOf(visual);
  const parts = visual
    .split(/\s*\|\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !/^(on-screen text|source tag|transition)\b/i.test(part));
  const expanded: string[] = [];
  for (const part of parts.length ? parts : [visual]) {
    if (/cut to/i.test(part)) {
      const [chart, rest] = part.split(/cut to/i);
      if (chart.trim()) expanded.push(chart.trim());
      if (rest?.trim()) expanded.push(`GPU question ${rest.trim()}`);
    } else {
      expanded.push(part);
    }
  }
  return expanded.map((body) => ({
    kind: kindFor(body),
    title: titleFor(body, fallbackTitle),
    quotes: quotesOf(body),
    body,
    source,
  }));
}

export function isDescriptive(visual: string): boolean {
  return /visual\s*\d|source tag:|chart|diagram|card|distress line/i.test(visual);
}

/** Word groups line up with visual beats so the picture changes with the narration. */
export function windowsForBeats(words: CaptionCue[], beatCount: number, duration: number): { start: number; end: number }[] {
  const count = Math.max(1, beatCount);
  const total = Math.max(duration, 0.4);
  if (count === 1 || words.length === 0) return [{ start: 0, end: total }];
  const size = Math.ceil(words.length / count);
  const starts = [0];
  for (let index = 1; index < count; index++) {
    const word = words[Math.min(words.length - 1, index * size)];
    const at = word?.start ?? (total * index) / count;
    starts.push(Math.min(total - 0.3, Math.max(starts[starts.length - 1] + 0.3, at)));
  }
  return starts.map((start, index) => ({
    start,
    end: index + 1 < starts.length ? starts[index + 1] : total,
  }));
}

export type BeatStage = {
  beat: Beat;
  start: number;
  end: number;
};

function wordAt(words: CaptionCue[], pattern: RegExp, from = 0): CaptionCue | undefined {
  return words.find((word) => word.start >= from - 0.02 && pattern.test(word.text));
}

function finishStages(stages: BeatStage[], total: number): BeatStage[] {
  const out: BeatStage[] = [];
  for (const stage of stages) {
    const start = out.length ? Math.max(stage.start, out[out.length - 1].end) : Math.max(0, stage.start);
    if (start >= total - 0.2) break;
    const end = Math.min(total, Math.max(start + 0.35, stage.end));
    out.push({ ...stage, beat: stage.beat, start, end });
  }
  if (out.length) out[out.length - 1].end = total;
  return out.length ? out : [{ beat: stages[0]?.beat ?? { kind: "generic", title: "", quotes: [], body: "", source: "" }, start: 0, end: total }];
}

/**
 * Lines a scene's beats up with the words. The checklist opens on "lien",
 * "debt", and "keys" instead of three equal slices of the whole scene.
 */
export function stagesForScene(beats: Beat[], words: CaptionCue[], duration: number): BeatStage[] {
  const total = Math.max(duration, 0.4);
  if (!beats.length) return [{ beat: { kind: "generic", title: "", quotes: [], body: "", source: "" }, start: 0, end: total }];
  const listIndex = beats.findIndex((beat) => beat.kind === "list");
  if (listIndex >= 0) {
    const lien = wordAt(words, /\bliens?\b/i);
    const debt = wordAt(words, /\bdebts?\b/i, lien ? lien.end : 0);
    const keys = wordAt(words, /\bkeys?\b/i, debt ? debt.end : 0);
    if (lien && debt && keys && lien.start < debt.start && debt.start < keys.start && keys.start < total - 0.4) {
      const site = words.find((word) => word.start >= keys.end - 0.05 && /sovereign/i.test(word.text));
      const urlAt = Math.min(total - 0.45, Math.max(keys.end + 0.2, site?.start ?? keys.end + 0.8));
      const stages: BeatStage[] = [];
      const before = beats.slice(0, listIndex);
      if (before.length && lien.start > 0.5) {
        const leadWords = words
          .filter((word) => word.start < lien.start)
          .map((word) => ({ ...word, start: word.start, end: word.end }));
        const lead = windowsForBeats(leadWords, before.length, lien.start);
        before.forEach((beat, index) => stages.push({ beat, start: lead[index].start, end: lead[index].end }));
      } else if (lien.start > 0.45) {
        stages.push({ beat: { ...beats[listIndex], reveal: 0 }, start: 0, end: lien.start });
      }
      const list = beats[listIndex];
      const cuts = [Math.max(stages.length ? stages[stages.length - 1].end : 0, lien.start), debt.start, keys.start, urlAt];
      [1, 2, 3].forEach((reveal, index) => {
        stages.push({ beat: { ...list, reveal }, start: cuts[index], end: cuts[index + 1] });
      });
      const after = beats.slice(listIndex + 1);
      if (after.length) {
        const restDuration = Math.max(0.45, total - urlAt);
        const restWords = words
          .filter((word) => word.start >= urlAt)
          .map((word) => ({ ...word, start: word.start - urlAt, end: word.end - urlAt }));
        const rest = windowsForBeats(restWords, after.length, restDuration);
        after.forEach((beat, index) => {
          stages.push({ beat, start: urlAt + rest[index].start, end: urlAt + rest[index].end });
        });
      }
      return finishStages(stages, total);
    }
  }

  const base = windowsForBeats(words, beats.length, total);
  const stages: BeatStage[] = [];
  beats.forEach((beat, index) => {
    const window = base[index] || { start: 0, end: total };
    if (beat.kind === "list") {
      const span = Math.max(0.45, window.end - window.start);
      for (let reveal = 1; reveal <= 3; reveal++) {
        stages.push({
          beat: { ...beat, reveal },
          start: window.start + ((reveal - 1) * span) / 3,
          end: window.start + (reveal * span) / 3,
        });
      }
      return;
    }
    if (beat.kind === "compare" && /acquired|restructured|default/i.test(beat.body)) {
      const span = Math.max(0.45, window.end - window.start);
      [0, 1, 2].forEach((providerState) => {
        stages.push({
          beat: { ...beat, providerState },
          start: window.start + (providerState * span) / 3,
          end: window.start + ((providerState + 1) * span) / 3,
        });
      });
      return;
    }
    stages.push({ beat, start: window.start, end: window.end });
  });
  return finishStages(stages, total);
}
