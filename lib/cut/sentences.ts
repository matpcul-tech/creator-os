// Splitting script text into sentences and short clauses for scenes and cards.
// Splits only at real sentence or clause boundaries and never adds or changes punctuation.

const ABBREVIATION = /(?:^|[\s(])(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|inc|ltd|co|no|approx|fig|dept|est|e\.g|i\.e|u\.s|u\.k|a\.m|p\.m|[a-z])\.$/i;
const CONJUNCTION = new Set(["and", "but", "so", "because", "which", "while", "when", "where", "although", "though", "or", "since", "unless", "until", "whereas"]);

function count(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Sentences in a line. A boundary is . ! or ? followed by a space and a capital letter, digit or
 * opening quote, and not after an abbreviation or an initial, so "Dr. Attia" and "2.5 hours" stay whole.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[.!?]+["'\u201d\u2019)]*(?=\s+)/g;
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const end = match.index + match[0].length;
    const piece = text.slice(start, end);
    const next = text.slice(end).trimStart();
    if (!/^["'\u201c\u2018(]?[A-Z0-9]/.test(next)) continue;
    if (/^\.+$/.test(match[0]) && ABBREVIATION.test(piece)) continue;
    if (piece.trim()) out.push(piece.trim());
    start = end;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

// A clause with no punctuation that is still too long is broken before a joining word near its
// middle ("and", "because", "which"...), never inside a phrase. With no such word it stays whole.
function breakAtConjunction(part: string, hard: number, min: number): string[] {
  const words = part.split(/\s+/).filter(Boolean);
  if (words.length <= hard) return [part];
  const middle = words.length / 2;
  let best = -1;
  for (let i = min; i <= words.length - min; i++) {
    if (!CONJUNCTION.has(words[i].toLowerCase())) continue;
    if (best < 0 || Math.abs(i - middle) < Math.abs(best - middle)) best = i;
  }
  if (best < 0) return [part];
  return [
    ...breakAtConjunction(words.slice(0, best).join(" "), hard, min),
    ...breakAtConjunction(words.slice(best).join(" "), hard, min),
  ];
}

/**
 * Breaks one sentence into lines of about `target` words, but only after a comma, semicolon or
 * colon. A sentence of `trigger` words or fewer stays whole. A piece longer than `hard` words with
 * no clause mark is broken before a joining word. No piece is shorter than `min` words when it can
 * join a neighbour.
 */
export function splitClauses(sentence: string, opts: { trigger: number; target: number; hard: number; min?: number }): string[] {
  const text = sentence.trim();
  const min = opts.min ?? 4;
  if (count(text) <= opts.trigger) return text ? [text] : [];
  const clauses = text.split(/(?<=[,;:])\s+/);
  const parts: string[] = [];
  let buf = "";
  for (const clause of clauses) {
    const next = buf ? `${buf} ${clause}` : clause;
    if (buf && count(next) > opts.target && count(buf) >= min && count(clause) >= min) {
      parts.push(buf);
      buf = clause;
    } else {
      buf = next;
    }
  }
  if (buf) parts.push(buf);
  return parts.flatMap((part) => breakAtConjunction(part, opts.hard, min));
}
