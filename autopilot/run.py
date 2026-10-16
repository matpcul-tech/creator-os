"""Red Sky Archive daily autopilot.

One run = pick a book or game, write a 30 to 45 second script, voice it with
edge-tts, render a vertical Short in the Red Sky style, upload it to YouTube.

Env:
  STATE_DIR            folder holding config.json and log.json (default ./state-local)
  OUT_DIR              where the MP4 lands (default ./out)
  DRY_RUN=1            render everything, skip the upload
  AUTOPILOT_TRIGGER    schedule | manual
  FORCE=1              run even if paused or the slot is already filled
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
DEFAULT_CONFIG = {"paused": False, "time_central": ["11:30", "18:30"], "privacy": "public"}

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

# ---------------------------------------------------------------- state
def load_state():
    os.makedirs(STATE_DIR, exist_ok=True)
    cp, lp = os.path.join(STATE_DIR, "config.json"), os.path.join(STATE_DIR, "log.json")
    cfg = {**DEFAULT_CONFIG, **(json.load(open(cp)) if os.path.exists(cp) else {})}
    log = json.load(open(lp)) if os.path.exists(lp) else []
    return cfg, log

def save_log(log):
    json.dump(log[-200:], open(os.path.join(STATE_DIR, "log.json"), "w"), indent=2)

def pick(log):
    posted = [e for e in log if e.get("status") in ("posted", "dry_run")]
    last = {}
    for i, e in enumerate(posted): last[e["item"]] = i
    items = sorted(LIB["items"], key=lambda it: (last.get(it["id"], -1), LIB["items"].index(it)))
    item = items[0]
    used = [e["angle"] for e in posted if e["item"] == item["id"]]
    recent = used[-(len(item["angles"]) - 1):] if len(item["angles"]) > 1 else []
    fresh = [a for a in item["angles"] if a not in recent] or item["angles"]
    # prefer the angle used least overall for this item
    angle = sorted(fresh, key=lambda a: (used.count(a), item["angles"].index(a)))[0]
    return item, angle

# ---------------------------------------------------------------- script
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

def ai_script(item, angle, log):
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key: return None, "no ANTHROPIC_API_KEY, used template"
    recent = [e.get("script", "") for e in log if e.get("script")][-8:]
    sys_prompt = ("You write narration for 30 to 45 second vertical YouTube Shorts for the channel Red Sky Archive, "
        "which promotes the books and games of author Matthew Culwell. Tone: cinematic, ominous, intimate, short sentences. "
        "HARD RULES: 1) Use ONLY the facts provided. Never invent characters, places, plot events, quotes, awards, prices, "
        "page counts, or formats. If a fact is not listed, do not say it. 2) Never use em dashes or en dashes. Use periods or commas. "
        "3) 75 to 105 words total. 4) The script must end with exactly the call to action given. "
        "5) Plain spoken text only, no stage directions, no emojis, no hashtags in the script.")
    user = {
        "item": item["title"], "kind": item["kind"], "series": item["series"], "tagline": item["tagline"],
        "facts": item["facts"], "call_to_action": item["cta"],
        "angle": ANGLES[angle]["label"] + ": " + ANGLES[angle]["brief"],
        "do_not_repeat_these_recent_scripts": recent,
        "return": "JSON only: {\"title\": under 70 characters, curiosity driven, no dashes, \"script\": the narration, \"description\": one or two sentences grounded in the facts}",
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
        out = {k: no_dashes(str(out.get(k, ""))) for k in ("title", "script", "description")}
        problems = validate(out["script"], item)
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
def render(item, script, mp3, words, vdur, out_mp4, qc_times=()):
    import numpy as np, cv2
    import engine as E, audio
    from engine import W, H, FPS
    LEAD, TAIL = 0.5, 2.2
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
    vis = item["visuals"]; rnd = random.Random(item["id"] + script[:20])
    order = vis[:]; rnd.shuffle(order)
    shots, t, k = [], 0.0, 0
    while t < end_t - 0.3:
        L = 2.6 + rnd.random() * 1.4
        shots.append((t, order[k % len(order)], L)); t += L; k += 1
    shots.append((end_t, "END", DUR - end_t))
    TF = E.font(E.FONT_CINZEL, 74 if len(item["endcard"]["title"]) > 16 else 84, "Bold")
    BYF = E.font(E.FONT_MONT, 46, "Medium"); AVF = E.font(E.FONT_MONT, 38, "Bold")
    ec = item["endcard"]
    endtxt = E.text_layer([(ec["title"], TF, 1060, (240, 232, 220), 4), (ec["line2"], BYF, 1135, (225, 215, 205), 0),
                           (ec["line3"], AVF, 1210, (255, 90, 80), 4)])
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
        u = min(tl / L, 1)
        cx, cy = v.get("cx", 0.5), v.get("cy", 0.5)
        dx = 0.03 if (int(st * 10) % 2) else -0.03
        return E.kb(img(v["file"]), u, v.get("z0", 1.04), v.get("z1", 1.13), cx, cy, min(max(cx + dx, 0), 1), cy)
    parts = E.Particles(110, 5)
    def frame(i):
        t = i / FPS
        k = max(j for j, s in enumerate(shots) if s[0] <= t)
        s = shots[k]; f = shot(s, t - s[0])
        XF = 0.45
        if k > 0 and t - s[0] < XF:
            p = shots[k - 1]; f = E.xfade(shot(p, t - p[0]), f, E.ease((t - s[0]) / XF))
        f = E.grade(f, i, 0.55)
        f = parts.draw(f, i)
        if s[1] == "END": f = E.over(f, endtxt, E.ease((t - s[0] - 0.3) / 0.9))
        f = E.render_caption(f, t, caps, 1400 if s[1] == "END" else 1330)
        f *= min(1, t / 0.5) * min(1, (DUR - t) / 0.8)
        return f
    if qc_times:
        return [(ts, frame(int(ts * FPS))) for ts in qc_times]
    work = os.path.dirname(mp3)
    hb = (62, LEAD, end_t) if item["id"] == "borrowed-heartbeat" else None
    seed = sum(map(ord, item["id"])) % 50
    audio.write(os.path.join(work, "music.wav"), audio.drone(DUR, seed, 41.2 if item["kind"] == "book" else 46.2, heartbeat=hb, hits=(0.4, round(DUR / 2, 1), end_t)))
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
    item, angle = pick(log)
    meta, note = ai_script(item, angle, log)
    if not meta: meta = fallback_script(item, angle)
    for k in ("title", "script", "description"): meta[k] = no_dashes(meta[k])
    assert not any(has_dash(meta[k]) for k in ("title", "script", "description"))
    entry.update(item=item["id"], angle=angle, title=meta["title"], script=meta["script"], script_source=meta["source"],
                 note=note, ai_cost_usd=meta.get("cost_usd", 0))
    work = os.path.join(OUT_DIR, "work"); os.makedirs(work, exist_ok=True)
    mp3, words, vdur = voice(meta["script"], work)
    out_mp4 = os.path.join(OUT_DIR, f"RSA_autopilot_{today}_{item['id']}.mp4")
    dur, shots, end_t = render(item, meta["script"], mp3, words, vdur, out_mp4)
    json.dump({"item": item["id"], "angle": angle, "dur": dur, "end_t": end_t, "vdur": vdur, "shots": [(s[0], s[1] if s[1] == "END" else s[1]["file"]) for s in shots],
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
        print(pick(load_state()[1])); sys.exit(0)
    sys.exit(main())
