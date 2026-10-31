// Checks for a finished script draft, plus the analytics line added to the next prompt.
// Hyphens are fine. Em dashes and en dashes are not used in this file.

export const OPENING_RULE = "opening must contain a concrete fact or question";
export const TAKEAWAY_RULE = "draft must include a clear takeaway";

const OPENING_WORDS = 50;

const OPENING_DETAIL =
  "The opening (hook section, or the first 50 words) does not contain a concrete fact or question.";
const TAKEAWAY_DETAIL =
  "The draft has no explicit takeaway or close section or line.";

const RESULT_TAIL =
  "The next script must address this number. Change the hook, the packaging, or the first 30 seconds so the next video improves the weak metric. Do not ignore the number.";

const WORD_NUMBER =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)\b/i;

const TAKEAWAY_PHRASE =
  /\b(?:takeaways?|in closing|closing thought|bottom line|the point is|main point|key lessons?|the lesson|remember this|what to remember|to sum up|in summary|in conclusion|the conclusion)\b/i;

const TAKEAWAY_LABEL =
  /^(?:key\s+takeaways?|takeaways?|closing thought|closing|in conclusion|the conclusion|conclusion|outro|bottom line|key lesson|the lesson|main point)\b/i;

// Sentence-initial capitals that are ordinary words, not names.
// Lookups strip apostrophes, so contractions are stored without them.
const COMMON = new Set(
  `a about above after again against all almost already also always am among an and another any anyone anything are arent around as at
  back be because been before being below best better between both brief build building builds burn burns burned but by
  can cannot cant caption captions career change changed changes channel channels chase chased chasing clear close closed closer
  come comes coming consistency consistent content could couldnt creator creators cta
  day days did didnt do does doesnt doing don dont done down during
  each early email energy even ever every everyone everything
  fail failed fails failure fast feel feeling feels few first focus for forget forgets forgetting format formats from further
  get gets getting give given go going good great grow growing growth guess guessed guesses guessing
  habit habits had has have having he health hello her here heres hers herself hey hi him himself his home house how
  i id if im in into is isnt it its itself
  job jobs just
  keep keeping know knowing
  last later learn learning learns least less lesson lessons let lets life like likely line lines listen little live lives long look looking lot lots love
  made make makes making many march may me media might mine money month months more morning most much must my myself
  need needs never new next night no nobody none nor not nothing now
  of off often on once one only onto open opens opening or other our ours ourselves out outro over own
  paced people person phone pick picks place places please point points post posting posts
  quit quits quitting
  really reason remember remembered right
  said same say says script scripts see seem seems share shares sharing she ship ships shipping should since sleep small so social some someone something start started starting starts step steps still stop stopping story stories struggle struggles success such
  take taking talk talking talks tell telling than thanks that thats the their theirs them themselves then there theres these they theyre thing things think thinking this those through thumbnail thumbnails time times tip tips to today todays too trend trends try trying
  under until up upon us use used using
  very video videos view viewer viewers views
  want wants was wasnt watch watching way we welcome week weeks well were werent what whats when where which while who whom why will with within without wont work working works world would wouldnt
  youll theyll ill youve theyve weve hasnt havent hadnt shouldnt mustnt
  year years you your youre yours yourself
  hook hooks idea ideas audience audiences algorithm algorithms intro body setup payoff
  takeaway takeaways closing conclusion
  simply simple actually over under into within again back out
  why because while during about
  publish publishes publishing`
    .split(/\s+/)
    .filter(Boolean),
);

export type ScriptRuleViolation = {
  rule: string;
  detail: string;
};

export function readOptionalFinite(
  value: unknown,
  field: string,
): { ok: true; value?: number } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true };
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: `${field} must be a finite number` };
  }
  return { ok: true, value };
}

export function previousResultLine(lastCtr?: number, lastRetention?: number): string | null {
  const parts: string[] = [];
  if (lastCtr !== undefined) parts.push(`last video CTR was ${formatMetric(lastCtr)}%`);
  if (lastRetention !== undefined) parts.push(`30-second retention was ${formatMetric(lastRetention)}%`);
  if (parts.length === 0) return null;
  return `Previous result: ${parts.join(" / ")}. ${RESULT_TAIL}`;
}

export function injectPreviousResult(prompt: string, lastCtr?: number, lastRetention?: number): string {
  const line = previousResultLine(lastCtr, lastRetention);
  if (!line) return prompt;
  return `${prompt}\n\n${line}`;
}

export function scriptRuleViolations(script: string): ScriptRuleViolation[] {
  const violations: ScriptRuleViolation[] = [];
  if (!openingHasFactOrQuestion(script)) {
    violations.push({ rule: OPENING_RULE, detail: OPENING_DETAIL });
  }
  if (!hasClearTakeaway(script)) {
    violations.push({ rule: TAKEAWAY_RULE, detail: TAKEAWAY_DETAIL });
  }
  return violations;
}

export function ruleRejection(violations: ScriptRuleViolation[]): {
  error: string;
  rule: string;
  rules: string[];
} {
  const rules = violations.map((v) => v.rule);
  const named = rules.map((rule) => `"${rule}"`).join(" and ");
  const details = violations.map((v) => v.detail).join(" ");
  const error =
    rules.length === 1
      ? `Rejected by hard rule ${named}. ${details}`
      : `Rejected by hard rules ${named}. ${details}`;
  return { error, rule: rules[0] ?? "", rules };
}

export function rewriteFeedback(violations: ScriptRuleViolation[], draft: string): string {
  const lines = [
    "The draft failed a hard rule. Rewrite the full script so it passes. Output only the script. No preamble.",
  ];
  for (const v of violations) {
    lines.push(`Failed rule: ${v.rule}. ${v.detail}`);
    lines.push(fixFor(v.rule));
  }
  lines.push("Previous draft:", '"""', clip(draft), '"""');
  return lines.join("\n");
}

export function continuationRuleNote(violations: ScriptRuleViolation[]): string {
  const lines = ["The script so far failed a hard rule. Keep going from the end. Do not restart."];
  for (const v of violations) {
    lines.push(`Failed rule: ${v.rule}. ${v.detail}`);
    lines.push(fixFor(v.rule));
  }
  return lines.join(" ");
}

function fixFor(rule: string): string {
  if (rule === OPENING_RULE) {
    return "Put a concrete fact or a question in the opening (the hook, or the first 50 words). Use a question mark, or a number, date, percent, dollar amount, or named entity.";
  }
  return "End with an explicit takeaway or close line, for example: Takeaway: one sentence the viewer should remember.";
}

function openingHasFactOrQuestion(script: string): boolean {
  const opening = openingText(script);
  if (!opening) return false;
  if (opening.includes("?")) return true;
  if (/\d/.test(opening)) return true;
  if (/\$\s?\d/.test(opening) || /\bdollars?\b/i.test(opening)) return true;
  if (/%/.test(opening) || /\bpercent(?:age)?s?\b/i.test(opening)) return true;
  if (hasDate(opening)) return true;
  if (WORD_NUMBER.test(opening.replace(/\bno one\b/gi, " ").replace(/\bone of\b/gi, " "))) return true;
  if (hasNamedEntity(opening)) return true;
  return false;
}

export function openingText(script: string): string {
  const section = hookSection(script);
  // A labeled takeaway is the close, not the opening, even on a short script.
  const source = section ?? script.split("\n").filter((line) => !isTakeawayLabel(line)).join("\n");
  return firstWords(source, OPENING_WORDS);
}

function hookSection(script: string): string | null {
  const lines = script.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const labeled = hookLabel(lines[i]);
    if (!labeled) continue;
    const chunks: string[] = [];
    if (labeled.narration) chunks.push(labeled.narration);
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next) continue;
      if (isSectionLabel(next)) break;
      chunks.push(next);
    }
    const text = chunks.join(" ").trim();
    if (text) return text;
  }
  return null;
}

function hookLabel(line: string): { narration: string } | null {
  const trimmed = line.trim().replace(/^#{1,6}\s+/, "");
  const match = trimmed.match(/^(hook|cold open|opening)\b\s*(.*)$/i);
  if (!match) return null;
  const rest = match[2].trim();
  if (!rest) return { narration: "" };
  const paren = rest.match(/^\([^)]*\)\s*[:\-.]?\s*(.*)$/);
  if (paren) return { narration: paren[1].trim() };
  if (/^[:\-.]/.test(rest)) return { narration: rest.replace(/^[:\-.]+\s*/, "") };
  return null;
}

function isSectionLabel(line: string): boolean {
  const trimmed = line.trim().replace(/^#{1,6}\s+/, "");
  if (/^#{1,6}\s+\S/.test(line.trim()) && line.trim().length < 80 && !hookLabel(line)) {
    // A markdown heading ends the hook section.
    return true;
  }
  const match = trimmed.match(
    /^(hook|cold open|opening|setup|intro|body|main|payoff|cta|outro|key takeaway|takeaway|closing|close|conclusion|segment|caption|slide)\b\s*(.*)$/i,
  );
  if (!match) return false;
  const rest = match[2].trim();
  if (!rest) return true;
  if (/^[:\-.]/.test(rest)) return true;
  if (/^\([^)]*\)\s*[:\-.]?\s*$/.test(rest)) return true;
  if (/^\d+\b/.test(rest) && rest.length < 40) return true;
  return false;
}

function hasClearTakeaway(script: string): boolean {
  if (script.split(/\n/).some((line) => isTakeawayLabel(line))) return true;
  const words = script.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return false;
  const sample = words.length <= 80 ? script : words.slice(Math.floor(words.length / 2)).join(" ");
  return TAKEAWAY_PHRASE.test(sample);
}

function isTakeawayLabel(line: string): boolean {
  const trimmed = line.trim().replace(/^#{1,6}\s+/, "");
  const match = trimmed.match(TAKEAWAY_LABEL);
  if (match) {
    const rest = trimmed.slice(match[0].length).trim();
    if (!rest || /^[:\-.]/.test(rest) || /^\([^)]*\)\s*[:\-.]?\s*$/.test(rest)) return true;
  }
  if (/^(?:the\s+)?close\s*[:\-.]?\s*$/i.test(trimmed)) return true;
  if (/^(?:the\s+)?close\s*[:\-]\s+\S/i.test(trimmed)) return true;
  return false;
}

function hasDate(text: string): boolean {
  if (/\b(?:january|february|april|june|july|august|september|october|november|december)\b/i.test(text)) {
    return true;
  }
  if (/\b(?:in|on|last|this|next|early|late|since|during|by|of)\s+march\b/i.test(text)) return true;
  if (/\bMarch\b/.test(text) && !/\bMarch\s+(?:on|forward|ahead|toward|towards|into|with)\b/.test(text)) {
    return true;
  }
  if (/\b(?:in|on|last|this|next|early|late|since|during|by|of)\s+may\b/i.test(text)) return true;
  return false;
}

function hasNamedEntity(text: string): boolean {
  if (hasAcronym(text)) return true;
  if (hasInternalCapital(text)) return true;
  const sentences = text.split(/\n+|(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const words = sentence.match(/[A-Za-z][A-Za-z'’]*/g) ?? [];
    for (const word of words) {
      if (word === "I") continue;
      if (!/^[A-Z]/.test(word)) continue;
      if (/[A-Z]/.test(word.slice(1))) continue;
      if (COMMON.has(normalizeWord(word))) continue;
      return true;
    }
  }
  return false;
}

function hasAcronym(text: string): boolean {
  const words = text.match(/[A-Za-z][A-Za-z'’]*/g) ?? [];
  if (words.length >= 3) {
    const shouty = words.filter((word) => word.length > 1 && word === word.toUpperCase());
    if (shouty.length / words.length > 0.6) return false;
  }
  const caps = text.match(/\b[A-Z]{2,6}\b/g) ?? [];
  return caps.some((word) => {
    if (word === "OK" || word === "AM" || word === "PM") return false;
    return !COMMON.has(word.toLowerCase());
  });
}

function hasInternalCapital(text: string): boolean {
  const words = text.match(/[A-Za-z][A-Za-z'’]*/g) ?? [];
  return words.some((word) => /[a-z]/.test(word) && /[A-Z]/.test(word.slice(1)));
}

function firstWords(text: string, count: number): string {
  return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).slice(0, count).join(" ");
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/['’]/g, "");
}

function formatMetric(value: number): string {
  if (Object.is(value, -0)) return "0";
  return String(value);
}

function clip(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 12000) return trimmed;
  return trimmed.slice(0, 12000);
}
