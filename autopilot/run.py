"""Red Sky Archive daily autopilot.

One run = pick a book or game plus a visual style (real gameplay, gameplay mixed
with key art, or cinematic key art), a hook opener and a title pattern, all rotated
so consecutive Shorts never share style, footage, opener or title pattern. Claude
writes the script and an on screen hook line, edge-tts voices it, the Short is
rendered with the hook on screen and moving from frame 0, then uploaded.

Env:
  STATE_DIR            folder holding config.json and log.json (default ./state-local)
  OUT_DIR              where the MP4 lands (default ./out)
  DRY_RUN=1            render everything, skip the upload
  AUTOPILOT_TRIGGER    schedule | manual
  FORCE=1              run even if paused or the slot is already filled
  PICK_ITEM            manual runs only: preview this library item id instead of the rotation pick
  ANTHROPIC_API_KEY    optional; without it a grounded template script is used
  YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN   needed for a real upload
"""
import asyncio, datetime as dt, json, os, random, re, subprocess, sys, urllib.request, urllib.error
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
CHI = ZoneInfo("America/Chicago")
STATE_DIR = os.environ.get("STATE_DIR", os.path.join(HERE, "state-local"))
OUT_DIR = os.environ.get("OUT_DIR", os.path.join(HERE, "out"))
DRY = os.environ.get("DRY_RUN", "") in ("1", "true", "yes")
FORCE = os.environ.get("FORCE", "") in ("1", "true", "yes")
TRIGGER = os.environ.get("AUTOPILOT_TRIGGER", "manual")
MODEL = os.environ.get("AI_MODEL", "claude-sonnet-4-6")
VOICE = "en-US-ChristopherNeural"
MAX_AI_CALLS = 3  # hard per-run cap, about 2 cents each on Sonnet
LIB = json.load(open(os.path.join(HERE, "library.json")))
ANGLES = {a["id"]: a for a in LIB["angles"]}
DEFAULT_CONFIG = {"paused": False, "time_central": ["11:30"], "privacy": "public"}
STYLES = {s["id"]: s for s in LIB["styles"]}
PATTERNS = {p["id"]: p for p in LIB["title_patterns"]}

# ---------------------------------------------------------------- slots
def parse_slots(tc):
    """time_central may be "11:30" or ["11:30", "18:30"]. Returns sorted "HH:MM" strings."""
    if isinstance(tc, str): tc = [t for t in re.split(r"[,\s]+", tc) if t]
    out = []
    for t in tc or ["11:30"]:
        hh, mm = map(int, str(t).split(":")); out.append(f"{hh:02d}:{mm:02d}")
    return sorted(set(out))

def filled_slots(log, day, slots):
    """Slots already used on a Central date. Old entries without a slot fill the earliest open slot,
    so a legacy or forced post counts against the schedule (11:53 fills 11:30, a 4:42 PM force fills 18:30)."""
    filled = set()
    for e in log:
        if e.get("date") != day or e.get("status") != "posted": continue
        sl = e.get("slot")
        if sl in slots: filled.add(sl); continue
        if sl: continue  # "extra" or a slot no longer configured
        open_ = [x for x in slots if x not in filled]
        if open_: filled.add(open_[0])
    return filled

def due_slot(now, log, slots):
    """The slot this run should fill, or None. Uses the latest slot at or before now (Central);
    a missed earlier slot is not made up, so a day never gets more posts than slots."""
    day = now.date().isoformat(); hm = now.strftime("%H:%M")
    due = [x for x in slots if x <= hm]
    if not due: return None
    filled = filled_slots(log, day, slots)
    return None if due[-1] in filled else due[-1]


# ---------------------------------------------------------------- text rules
DASHES = re.compile(r"\s*[\u2012\u2013\u2014\u2015\u2212]\s*")

def no_dashes(s: str) -> str:
    s = DASHES.sub(", ", s)
    s = re.sub(r"\s+--\s+", ", ", s)
    s = re.sub(r",\s*([.,!?])", r"\1", s)
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip()

def has_dash(s: str) -> bool:
    return bool(re.search(r"[\u2012\u2013\u2014\u2015\u2212]", s)) or " -- " in s

def words_of(s): return re.findall(r"[A-Za-z0-9']+", s)

def allowed_vocab(item):
    blob = " ".join([item["title"], item["tagline"], item["cta"], item["series"], LIB["channel"]["author"], *item["facts"]])
    return {w.lower() for w in words_of(blob)}

COMMON_CAPS = {"i", "you", "she", "he", "it", "they", "we", "what", "and", "but", "then", "now", "the", "a", "an",
    "every", "one", "no", "this", "that", "who", "how", "why", "when", "if", "some", "nobody", "everyone", "your", "her",
    "his", "their", "our", "my", "in", "on", "at", "free", "play", "read", "link", "amazon", "kindle", "unlimited", "book",
    "series", "game", "ai", "so", "because", "until", "after", "before", "imagine", "listen", "welcome", "there", "here",
    "only", "out", "not", "do", "don't", "can", "could", "would", "will", "is", "are", "was", "were", "be", "yes", "never",
    "two", "three", "first", "last", "inside", "behind", "under", "for", "from", "with", "by", "to", "of", "or", "all"}

def unknown_names(script, item):
    """Capitalized words mid-sentence that never appear in the facts. Catches invented names."""
    vocab = allowed_vocab(item) | COMMON_CAPS
    bad = []
    for sent in re.split(r"(?<=[.!?])\s+", script):
        toks = sent.split()
        for t in toks[1:]:
            w = re.sub(r"[^A-Za-z']", "", t)
            if w and w[0].isupper() and w.lower() not in vocab:
                bad.append(w)
    return sorted(set(bad))

def validate(script, item):
    n = len(words_of(script))
    problems = []
    if has_dash(script): problems.append("contains a dash")
    if n < 70 or n > 112: problems.append(f"{n} words, need 70 to 112")
    bad = unknown_names(script, item)
    if bad: problems.append("names not in the facts: " + ", ".join(bad))
    if not script.rstrip().endswith(item["cta"].rstrip()): problems.append("must end with the exact call to action")
    return problems

def title_words(t): return {w.lower() for w in words_of(t) if w.lower() not in ("shorts", "the", "a", "an", "is", "of", "to", "you", "it")}

def fits_pattern(title, pattern):
    t = title.strip()
    return {"question": t.endswith("?"), "pov": t.lower().startswith("pov:"), "you": t.lower().startswith("you"),
            "warning": bool(re.match(r"(?i)(do not|don't|never)\b", t)),
            "statement": "?" not in t and 3 <= len(words_of(t)) <= 8}.get(pattern, True)

def check_title(title, pattern, recent_titles):
    problems = []
    if has_dash(title): problems.append("title contains a dash")
    if len(title) > 70: problems.append("title over 70 characters")
    if not fits_pattern(title, pattern): problems.append(f"title does not follow the {pattern} pattern: {PATTERNS[pattern]['brief']}")
    tw = title_words(title)
    for r in recent_titles:
        rw = title_words(r)
        if rw and len(tw & rw) / max(1, len(tw | rw)) > 0.4: problems.append(f"title too close to a recent title: {r}")
        if words_of(title)[:2] and [w.lower() for w in words_of(title)[:2]] == [w.lower() for w in words_of(r)[:2]]:
            problems.append(f"title starts like a recent title: {r}")
    return problems

def check_hook(hook, item):
    problems = []
    n = len(words_of(hook))
    if has_dash(hook): problems.append("hook contains a dash")
    if n < 2 or n > 8: problems.append(f"hook is {n} words, need 2 to 8")
    if re.match(r"(?i)(imagine|welcome|in a world|what if)\b", hook): problems.append("hook opener is generic")
    bad = unknown_names(hook, item)
    if bad: problems.append("hook names not in the facts: " + ", ".join(bad))
    return problems

# ---------------------------------------------------------------- state
def load_state():
    os.makedirs(STATE_DIR, exist_ok=True)
    cp, lp = os.path.join(STATE_DIR, "config.json"), os.path.join(STATE_DIR, "log.json")
    cfg = {**DEFAULT_CONFIG, **(json.load(open(cp)) if os.path.exists(cp) else {})}
    log = json.load(open(lp)) if os.path.exists(lp) else []
    return cfg, log

def save_log(log):
    json.dump(log[-200:], open(os.path.join(STATE_DIR, "log.json"), "w"), indent=2)

def history(log):
    """Real posts only, so a dry run previews exactly what the next real post would be."""
    return [e for e in log if e.get("status") == "posted"]

def clips_for(item):
    return [c for c in LIB.get("clips", []) if c["game"] in item.get("footage", [])]

def pick_footage(item, style, avoid, rnd):
    """Files for this video. Never reuses a file from the previous video."""
    clips = [c["file"] for c in clips_for(item) if c["file"] not in avoid]
    stills = [v["file"] for v in item["visuals"] if v["file"] not in avoid] or [item["visuals"][0]["file"]]
    rnd.shuffle(clips)
    if style == "gameplay": return clips[:4]
    if style == "mixed": return clips[:3] + list(dict.fromkeys(stills))[:3]
    return list(dict.fromkeys(stills))

def pick(log, seed=None):
    """Item by least recently posted, then a style, opener, title pattern and footage that all differ
    from the previous post. Items whose only style would repeat are skipped for now and stay first in line."""
    posted = history(log)
    prev = posted[-1] if posted else {}
    rnd = random.Random(seed if seed is not None else len(posted))
    last = {}
    for i, e in enumerate(posted): last[e["item"]] = i
    items = sorted(LIB["items"], key=lambda it: (last.get(it["id"], -1), LIB["items"].index(it)))
    only = os.environ.get("PICK_ITEM", "").strip()
    if only and TRIGGER != "schedule": items = [it for it in items if it["id"] == only] or items  # manual preview of one item
    def lru(options, key):
        used = [e.get(key) for e in posted]
        return sorted(options, key=lambda o: (max([i for i, u in enumerate(used) if u == o], default=-1), rnd.random()))
    for item in items:
        styles = [s for s in STYLES if not STYLES[s]["needs_footage"] or len(clips_for(item)) >= 3]
        styles = [s for s in lru(styles, "style") if s != prev.get("style")]
        styles.sort(key=lambda s: not STYLES[s]["needs_footage"])  # real footage first when the item has it
        if not styles: continue
        style = styles[0]
        footage = pick_footage(item, style, set(prev.get("footage", [])), rnd)
        if style != "cinematic" and len([f for f in footage if f.endswith(".mp4")]) < 3: continue
        used = [e["angle"] for e in posted if e["item"] == item["id"]]
        recent = used[-(len(item["angles"]) - 1):] if len(item["angles"]) > 1 else []
        fresh = [a for a in item["angles"] if a not in recent] or item["angles"]
        angle = sorted(fresh, key=lambda a: (used.count(a), item["angles"].index(a)))[0]
        opener = [o for o in lru(LIB["openers"], "opener") if o != prev.get("opener")][0]
        pattern = [p for p in lru(list(PATTERNS), "title_pattern") if p != prev.get("title_pattern")][0]
        return {"item": item, "angle": angle, "style": style, "opener": opener, "title_pattern": pattern, "footage": footage}
    raise RuntimeError("no item fits the rotation rules")

# ---------------------------------------------------------------- script
def fallback_title(item, pattern, recent_titles):
    tag = item["tagline"].rstrip(".")
    first = re.split(r"(?<=[.!?])\s+", tag)[0].rstrip(".!?")
    name = item.get("short") or item["title"]
    opts = {"question": [f"Could you survive {name}?", f"Are you ready for {name}?"],
            "pov": [f"POV: you just found {name}", f"POV: {first}"],
            "you": [f"You are not ready for {name}", f"You were never meant to find {name}"],
            "warning": [f"Do not start {name} at night", f"Never play {name} alone"] if item["kind"] == "game"
                       else [f"Do not read {name} at night", f"Never start {name} before bed"],
            "statement": [first if 3 <= len(words_of(first)) <= 8 else f"{name} is not what it seems"]}[pattern]
    for t in opts:
        if not check_title(no_dashes(t), pattern, recent_titles): return no_dashes(t)
    return no_dashes(opts[0])

def fallback_hook(item):
    h = re.split(r"(?<=[.!?])\s+", item["tagline"])[0]
    return " ".join(h.split()[:7])

def fallback_script(item, angle):
    facts = [f for f in item["facts"] if not re.search(r"\b(is a|is Book|is a free)\b", f)] or item["facts"]
    if angle == "question": opener = "What if " + facts[0][0].lower() + facts[0][1:].rstrip(".") + "?"
    elif angle == "quote": opener = item["tagline"]
    elif angle == "game": opener = "This is not a trailer. You can play it right now."
    else: opener = facts[0]
    body = [opener] + [f for f in facts if f != facts[0] or angle in ("question", "quote", "game")]
    if angle == "quote" and item["tagline"] not in body[1:]: pass
    s = " ".join(body)
    if len(words_of(s + " " + item["cta"])) < 74 and item["tagline"] not in s: s += " " + item["tagline"]
    if len(words_of(s + " " + item["cta"])) < 74: s += " " + item["facts"][0]
    s = no_dashes(s + " " + item["cta"])
    title = no_dashes(item["tagline"].rstrip(".") + " | " + item["title"])
    return {"title": title, "script": s, "description": item["tagline"], "source": "template"}

def ai_script(item, angle, log, pattern="statement", style="cinematic"):
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key: return None, "no ANTHROPIC_API_KEY, used template"
    recent = [e.get("script", "") for e in log if e.get("script")][-8:]
    recent_titles = [e["title"] for e in log if e.get("title")][-15:]
    sys_prompt = ("You write narration for 30 to 45 second vertical YouTube Shorts for the channel Red Sky Archive, "
        "which promotes the books and games of author Matthew Culwell. Tone: cinematic, ominous, intimate, short sentences. "
        "HARD RULES: 1) Use ONLY the facts provided. Never invent characters, places, plot events, quotes, awards, prices, "
        "page counts, or formats. If a fact is not listed, do not say it. 2) Never use em dashes or en dashes. Use periods or commas. "
        "3) 75 to 105 words total. 4) The script must end with exactly the call to action given. "
        "5) Plain spoken text only, no stage directions, no emojis, no hashtags in the script. "
        "6) Also write an on screen hook line of 2 to 8 words: bold, specific, built from one concrete detail in the facts, "
        "readable in under one second, in sentence case. It is the first thing the viewer sees. "
        "VARIETY: " + LIB["variety_rules"])
    user = {
        "item": item["title"], "kind": item["kind"], "series": item["series"], "tagline": item["tagline"],
        "facts": item["facts"], "call_to_action": item["cta"],
        "angle": ANGLES[angle]["label"] + ": " + ANGLES[angle]["brief"],
        "visual_style": STYLES[style]["label"] + (" (the viewer sees real footage of the game being played)" if style != "cinematic" else ""),
        "title_pattern": PATTERNS[pattern]["brief"],
        "do_not_repeat_these_recent_scripts": recent,
        "avoid_these_recent_titles": recent_titles,
        "return": "JSON only: {\"hook\": the 2 to 8 word on screen hook, \"title\": under 70 characters, follows title_pattern, unlike every recent title, no dashes, \"script\": the narration, \"description\": one or two sentences grounded in the facts}",
    }
    usage_total, last_err = {"input": 0, "output": 0}, ""
    msgs = [{"role": "user", "content": json.dumps(user)}]
    for attempt in range(MAX_AI_CALLS):
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", method="POST",
            data=json.dumps({"model": MODEL, "max_tokens": 700, "system": sys_prompt, "messages": msgs}).encode(),
            headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        try:
            r = json.load(urllib.request.urlopen(req, timeout=90))
        except urllib.error.HTTPError as e:
            last_err = f"Anthropic HTTP {e.code}"; break
        except Exception as e:
            last_err = f"Anthropic error {type(e).__name__}"; break
        usage_total["input"] += r.get("usage", {}).get("input_tokens", 0)
        usage_total["output"] += r.get("usage", {}).get("output_tokens", 0)
        text = "".join(b.get("text", "") for b in r.get("content", []))
        m = re.search(r"\{.*\}", text, re.S)
        try: out = json.loads(m.group(0)) if m else None
        except Exception: out = None
        if not out or not out.get("script"):
            last_err = "unparseable reply"; continue
        out = {k: no_dashes(str(out.get(k, ""))) for k in ("hook", "title", "script", "description")}
        problems = validate(out["script"], item) + check_title(out["title"], pattern, recent_titles) + check_hook(out["hook"], item)
        if not problems:
            out["source"] = "ai"; out["usage"] = usage_total
            out["cost_usd"] = round(usage_total["input"] * 3e-6 + usage_total["output"] * 15e-6, 4)
            return out, ""
        last_err = "; ".join(problems)
        msgs += [{"role": "assistant", "content": text}, {"role": "user", "content": "Fix these problems and return the JSON again: " + last_err}]
    return None, "AI script rejected (" + last_err + "), used template"

# ---------------------------------------------------------------- voice
async def _tts(text, mp3, rate):
    import edge_tts
    c = edge_tts.Communicate(text, VOICE, rate=rate, pitch="-4Hz", boundary="WordBoundary")
    words = []
    with open(mp3, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append((ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7, ch["text"]))
    return words

def voice(text, work):
    mp3 = os.path.join(work, "voice.mp3")
    rate = -5
    for _ in range(4):
        words = asyncio.run(_tts(text, mp3, f"{rate:+d}%"))
        d = words[-1][1]
        if d > 40.5 and rate < 20: rate += 7; continue
        if d < 26 and rate > -15: rate -= 6; continue
        break
    return mp3, words, d

# ---------------------------------------------------------------- render
class Clip:
    """Sequential reader for a gameplay clip, loops, resized to the frame on read."""
    def __init__(self, path):
        import cv2
        self.cap = cv2.VideoCapture(path); self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 30; self.pos = -1; self.cur = None
    def at(self, t, W, H):
        import cv2, numpy as np
        k = int(t * self.fps) % self.n
        if k != self.pos:
            if k != self.pos + 1: self.cap.set(cv2.CAP_PROP_POS_FRAMES, k)
            ok, im = self.cap.read()
            if ok:
                h, w = im.shape[:2]; sc = max(W / w, H / h)
                im = cv2.resize(im, (int(w * sc + .5), int(h * sc + .5)), interpolation=cv2.INTER_LINEAR)
                y0, x0 = (im.shape[0] - H) // 2, (im.shape[1] - W) // 2
                self.cur = im[y0:y0 + H, x0:x0 + W].astype(np.float32) / 255
            self.pos = k
        return self.cur

def render(item, script, mp3, words, vdur, out_mp4, qc_times=(), style="cinematic", opener="slam", hook="", footage=None):
    import numpy as np, cv2
    import engine as E, audio
    from engine import W, H, FPS
    LEAD, TAIL = 0.35, 2.2
    DUR = vdur + LEAD + TAIL; N = int(DUR * FPS)
    words = E.align(words, script)
    caps = E.cap_layers(words, LEAD)
    A = os.path.join(HERE, "assets")
    cache = {}
    def img(fn):
        if fn not in cache: cache[fn] = E.load(os.path.join(A, fn))
        return cache[fn]
    n_cta = len(item["cta"].split())
    end_t = (words[-n_cta][0] + LEAD) if len(words) > n_cta else DUR - 4
    end_t = min(end_t, DUR - 3.0)
    rnd = random.Random(item["id"] + script[:20])
    vis_by_file = {}
    for v in item["visuals"]: vis_by_file.setdefault(v["file"], v)
    footage = footage or [v["file"] for v in item["visuals"]]
    clips = [f for f in footage if f.endswith(".mp4")]
    stills = [vis_by_file.get(f, {"file": f}) for f in footage if not f.endswith(".mp4")]
    if style == "gameplay": order = [("clip", c) for c in clips]
    elif style == "mixed":
        order = []
        for k in range(max(len(clips), len(stills))):
            if k < len(clips): order.append(("clip", clips[k]))
            if k < len(stills): order.append(("still", stills[k]))
    else:
        order = [("still", v) for v in (stills or item["visuals"])]; rnd.shuffle(order)
    readers = {}
    def reader(f):
        if f not in readers: readers[f] = Clip(os.path.join(HERE, f))
        return readers[f]
    shots, t, k = [], 0.0, 0
    while t < end_t - 0.3:
        L = (1.5 + rnd.random() * 0.9) if style != "cinematic" else (2.4 + rnd.random() * 1.2)
        if k == 0: L = min(L, 1.8)  # fast first cut keeps the open moving
        shots.append((t, order[k % len(order)], L)); t += L; k += 1
    shots.append((end_t, "END", DUR - end_t))
    TF = E.font(E.FONT_CINZEL, 74 if len(item["endcard"]["title"]) > 16 else 84, "Bold")
    BYF = E.font(E.FONT_MONT, 46, "Medium"); AVF = E.font(E.FONT_MONT, 38, "Bold")
    ec = item["endcard"]
    endtxt = E.text_layer([(ec["title"], TF, 1060, (240, 232, 220), 4), (ec["line2"], BYF, 1135, (225, 215, 205), 0),
                           (ec["line3"], AVF, 1210, (255, 90, 80), 4)])
    hook_l = E.hook_layer(no_dashes(hook).upper(), opener) if hook else None
    HOOK_END = 2.0
    cover = img(item["cover"])
    def place(f, im, width, cx, cy, rot=0):
        h, w = im.shape[:2]; sc = width / w
        M = cv2.getRotationMatrix2D((w / 2, h / 2), rot, sc); M[0, 2] += cx - w / 2; M[1, 2] += cy - h / 2
        fg = cv2.warpAffine(im, M, (W, H), flags=cv2.INTER_AREA)
        m = cv2.warpAffine(np.ones((h, w), np.float32), M, (W, H))[..., None]
        sh = cv2.GaussianBlur(m[..., 0], (0, 0), 30)[..., None] * 0.85
        return f * (1 - sh) * (1 - m) + fg * m
    def shot(s, tl):
        st, v, L = s
        if v == "END":
            u = tl / max(L, 1)
            bg = cv2.GaussianBlur(E.kb(cover, u, 1.3, 1.4), (0, 0), 25) * 0.33
            return place(bg, cover, int(500 * (1 + 0.03 * u)), W / 2, 560, 0)
        kind, v = v
        u = min(tl / L, 1)
        if kind == "clip":
            rd = reader(v); span = max(rd.n / rd.fps - L, 0.01)
            f = rd.at(tl + (st * 1.7) % span, W, H)  # repeats of a clip show a different moment
            z = 1.03 + 0.05 * u  # slow push on top of the gameplay motion
            M = cv2.getRotationMatrix2D((W / 2, H / 2), 0, z)
            return cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        cx, cy = v.get("cx", 0.5), v.get("cy", 0.5)
        dx = 0.03 if (int(st * 10) % 2) else -0.03
        return E.kb(img(v["file"]), u, v.get("z0", 1.04), v.get("z1", 1.13), cx, cy, min(max(cx + dx, 0), 1), cy)
    parts = E.Particles(110, 5)
    red = 0.3 if style != "cinematic" else 0.55
    def frame(i):
        t = i / FPS
        k = max(j for j, s in enumerate(shots) if s[0] <= t)
        s = shots[k]; f = shot(s, t - s[0])
        XF = 0.12 if style != "cinematic" else 0.45
        if k > 0 and t - s[0] < XF:
            p = shots[k - 1]; f = E.xfade(shot(p, t - p[0]), f, E.ease((t - s[0]) / XF))
        if t < 1.0:  # opening motion: punch zoom in plus a decaying shake, starts on frame 0
            e = 1 - E.ease(t / 0.6)
            z = 1 + 0.18 * e if opener in ("slam", "flash") else 1.12 - 0.12 * E.ease(t)
            sx, sy = (np.sin(t * 61) * 14 * e, np.cos(t * 47) * 10 * e) if opener in ("slam", "glitch") else (0, 0)
            M = cv2.getRotationMatrix2D((W / 2, H / 2), 0, z); M[0, 2] += sx; M[1, 2] += sy
            f = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        f = E.grade(f, i, red)
        f = parts.draw(f, i)
        if hook_l is not None and t < HOOK_END: f = E.draw_hook(f, hook_l, t, HOOK_END, opener)
        if s[1] == "END": f = E.over(f, endtxt, E.ease((t - s[0] - 0.3) / 0.9))
        f = E.render_caption(f, t, caps, 1400 if s[1] == "END" else 1330)
        f *= min(1, (DUR - t) / 0.8)
        return f
    if qc_times:
        return [(ts, frame(int(ts * FPS))) for ts in qc_times]
    work = os.path.dirname(mp3)
    hb = (62, LEAD, end_t) if item["id"] == "borrowed-heartbeat" else None
    seed = sum(map(ord, item["id"])) % 50
    audio.write(os.path.join(work, "music.wav"), audio.drone(DUR, seed, 41.2 if item["kind"] == "book" else 46.2, heartbeat=hb, hits=(0.0, round(DUR / 2, 1), end_t)))
    audio.mix(mp3, os.path.join(work, "music.wav"), os.path.join(work, "mix.wav"), LEAD, DUR, -16)
    E.encode("render", frame, N, os.path.join(work, "mix.wav"), out_mp4)
    return DUR, shots, end_t

# ---------------------------------------------------------------- youtube
def yt_access_token():
    body = urllib.parse.urlencode({"client_id": os.environ["YT_CLIENT_ID"], "client_secret": os.environ["YT_CLIENT_SECRET"],
        "refresh_token": os.environ["YT_REFRESH_TOKEN"], "grant_type": "refresh_token"}).encode()
    try:
        r = json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=body), timeout=30))
    except urllib.error.HTTPError as e:
        err = json.loads(e.read() or b"{}").get("error", e.code)
        raise RuntimeError(f"Google token refresh failed ({err}). Reconnect on the Autopilot page and update YT_REFRESH_TOKEN.")
    return r["access_token"]

def youtube_metadata(item, meta, privacy):
    tags = [h.lstrip("#") for h in item["hashtags"]]
    title = meta["title"].strip() or item["title"]
    if "#shorts" not in title.lower() and len(title) <= 90: title += " #Shorts"
    title = no_dashes(title)[:100]
    desc = no_dashes("\n\n".join([meta.get("description") or item["tagline"],
        ("Play free: " if item["kind"] == "game" else "Get it: ") + item["link"],
        f"{item['title']} by {LIB['channel']['author']}.", "Narration uses an AI voice.", " ".join(item["hashtags"])]))[:4900]
    return {"snippet": {"title": title, "description": desc, "tags": tags, "categoryId": "24",
                        "defaultLanguage": "en", "defaultAudioLanguage": "en"},
            "status": {"privacyStatus": privacy, "selfDeclaredMadeForKids": False, "containsSyntheticMedia": True,
                       "embeddable": True, "license": "youtube"}}

def upload(path, body):
    tok = yt_access_token()
    size = os.path.getsize(path)
    init = urllib.request.Request("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        method="POST", data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {tok}",
        "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(size)})
    try:
        loc = urllib.request.urlopen(init, timeout=60).headers["Location"]
        with open(path, "rb") as f:
            put = urllib.request.Request(loc, method="PUT", data=f.read(), headers={"Content-Type": "video/mp4", "Content-Length": str(size)})
            r = json.load(urllib.request.urlopen(put, timeout=600))
    except urllib.error.HTTPError as e:
        try: reason = json.loads(e.read())["error"]["errors"][0].get("reason", "")
        except Exception: reason = ""
        raise RuntimeError(f"YouTube upload failed: HTTP {e.code} {reason}".strip())
    return r["id"]

# ---------------------------------------------------------------- main
def main():
    cfg, log = load_state()
    now = dt.datetime.now(CHI); today = now.date().isoformat()
    slots = parse_slots(cfg.get("time_central"))
    slot = None
    entry = {"date": today, "ts": now.isoformat(timespec="seconds"), "trigger": TRIGGER, "dry_run": DRY}
    def finish(status, **kw):
        entry.update(status=status, **kw); log.append(entry); save_log(log)
        print(json.dumps({k: v for k, v in entry.items() if k != "script"}, indent=2))
        summ = os.environ.get("GITHUB_STEP_SUMMARY")
        if summ:
            with open(summ, "a") as f:
                f.write(f"### Autopilot: {status}\n\n" + "\n".join(f"- **{k}**: {v}" for k, v in entry.items()) + "\n")
        return 0 if status in ("posted", "dry_run", "skipped") else 1
    if not FORCE:
        if cfg.get("paused"): return finish("skipped", reason="paused")
        if TRIGGER == "schedule":
            slot = due_slot(now, log, slots)
            if not slot:
                print("No open slot due right now in Central (other daylight saving cron, or already posted). Nothing to do.")
                return 0
    if not slot:  # manual or forced run: take the earliest open slot today, else mark it extra
        open_ = [x for x in slots if x not in filled_slots(log, today, slots)]
        slot = open_[0] if open_ else "extra"
    entry["slot"] = slot
    P = pick(log); item, angle = P["item"], P["angle"]
    recent_titles = [e["title"] for e in log if e.get("title")][-15:]
    meta, note = ai_script(item, angle, log, P["title_pattern"], P["style"])
    if not meta:
        meta = fallback_script(item, angle)
        meta["title"] = fallback_title(item, P["title_pattern"], recent_titles); meta["hook"] = fallback_hook(item)
    for k in ("hook", "title", "script", "description"): meta[k] = no_dashes(meta[k])
    assert not any(has_dash(meta[k]) for k in ("hook", "title", "script", "description"))
    entry.update(item=item["id"], angle=angle, style=P["style"], opener=P["opener"], title_pattern=P["title_pattern"],
                 footage=P["footage"], hook=meta["hook"], title=meta["title"], script=meta["script"], script_source=meta["source"],
                 note=note, ai_cost_usd=meta.get("cost_usd", 0))
    work = os.path.join(OUT_DIR, "work"); os.makedirs(work, exist_ok=True)
    mp3, words, vdur = voice(meta["script"], work)
    out_mp4 = os.path.join(OUT_DIR, f"RSA_autopilot_{today}_{item['id']}.mp4")
    dur, shots, end_t = render(item, meta["script"], mp3, words, vdur, out_mp4, style=P["style"], opener=P["opener"],
                               hook=meta["hook"], footage=P["footage"])
    json.dump({"item": item["id"], "angle": angle, "style": P["style"], "opener": P["opener"], "title_pattern": P["title_pattern"],
               "hook": meta["hook"], "title": meta["title"], "dur": dur, "end_t": end_t, "vdur": vdur,
               "shots": [(round(s[0], 2), s[1] if s[1] == "END" else (s[1][1] if isinstance(s[1][1], str) else s[1][1]["file"])) for s in shots],
               "script": meta["script"]}, open(os.path.join(OUT_DIR, "render.json"), "w"), indent=2)
    body = youtube_metadata(item, meta, cfg.get("privacy", "public"))
    json.dump(body, open(os.path.join(OUT_DIR, "youtube_request.json"), "w"), indent=2)
    entry.update(duration_s=round(dur, 1), file=os.path.basename(out_mp4))
    if DRY: return finish("dry_run")
    try:
        vid = upload(out_mp4, body)
    except Exception as e:
        return finish("failed", error=str(e)[:300])
    return finish("posted", videoId=vid, url=f"https://youtube.com/shorts/{vid}")

if __name__ == "__main__":
    import urllib.parse
    if len(sys.argv) > 1 and sys.argv[1] == "--pick":
        P = pick(load_state()[1]); P["item"] = P["item"]["id"]; print(P); sys.exit(0)
    sys.exit(main())
