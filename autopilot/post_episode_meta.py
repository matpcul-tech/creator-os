"""Post first comment, add to playlist, link previous episode description to the new one.
Pinning and Shorts related-video are Studio-only; this script does what the Data API allows.
"""
import json, os, re, sys, urllib.parse, urllib.request

def tok():
    body = urllib.parse.urlencode({
        "client_id": os.environ["YT_CLIENT_ID"],
        "client_secret": os.environ["YT_CLIENT_SECRET"],
        "refresh_token": os.environ["YT_REFRESH_TOKEN"],
        "grant_type": "refresh_token",
    }).encode()
    r = json.load(urllib.request.urlopen(urllib.request.Request(
        "https://oauth2.googleapis.com/token", data=body), timeout=30))
    return r["access_token"]

def api(method, url, token, data=None):
    req = urllib.request.Request(url, method=method,
        data=None if data is None else json.dumps(data).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"{method} {url.split('?')[0]} -> HTTP {e.code}: {err[:800]}")

def main():
    video_id = os.environ["VIDEO_ID"].strip()
    comment = os.environ.get("COMMENT", "").replace("\\n", "\n").strip()
    prev = os.environ.get("PREV_VIDEO_ID", "").strip()
    pq = os.environ.get("PLAYLIST_QUERY", "Borrowed Heartbeat").strip().lower()
    t = tok()
    out = {"video_id": video_id}
    info = json.load(urllib.request.urlopen(
        "https://oauth2.googleapis.com/tokeninfo?access_token=" + urllib.parse.quote(t), timeout=30))
    out["scopes"] = info.get("scope", "")

    if comment:
        try:
            body = {"snippet": {"videoId": video_id,
                "topLevelComment": {"snippet": {"textOriginal": comment}}}}
            r = api("POST", "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet", t, body)
            out["comment_id"] = r.get("id")
            out["comment_note"] = "posted; pin by hand in Studio (API cannot pin)"
        except Exception as e:
            out["comment_error"] = str(e)[:400]

    try:
        pls = []
        url = "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50"
        while url:
            r = api("GET", url, t)
            pls.extend(r.get("items", []))
            tok_n = r.get("nextPageToken")
            url = (f"https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50&pageToken={tok_n}"
                   if tok_n else None)
        out["playlists"] = [(p["id"], p["snippet"]["title"]) for p in pls]
        match = next((p for p in pls if pq in p["snippet"]["title"].lower()), None)
        if not match:
            match = next((p for p in pls if "borrowed" in p["snippet"]["title"].lower()), None)
        if not match:
            # create playlist
            body = {"snippet": {"title": "Borrowed Heartbeat", "description": "Borrowed Heartbeat episode series by Matthew Culwell."},
                    "status": {"privacyStatus": "public"}}
            match = api("POST", "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status", t, body)
            out["playlist_created"] = match.get("id")
        pid = match["id"] if "id" in match else match.get("id")
        title = match.get("snippet", {}).get("title", "Borrowed Heartbeat")
        body = {"snippet": {"playlistId": pid, "resourceId": {"kind": "youtube#video", "videoId": video_id}}}
        r = api("POST", "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", t, body)
        out["playlist_id"] = pid
        out["playlist_title"] = title
        out["playlist_item"] = r.get("id")
    except Exception as e:
        out["playlist_error"] = str(e)[:500]

    if prev:
        try:
            r = api("GET", f"https://www.googleapis.com/youtube/v3/videos?part=snippet&id={prev}", t)
            items = r.get("items") or []
            if not items:
                out["prev_error"] = "prev video not found"
            else:
                sn = items[0]["snippet"]
                desc = sn.get("description") or ""
                link = f"https://youtube.com/shorts/{video_id}"
                line = f"Watch next (Part 7): {link}"
                if video_id in desc:
                    out["prev_linked"] = "already"
                else:
                    if re.search(r"Watch next.*", desc):
                        desc2 = re.sub(r"Watch next.*", line, desc, count=1)
                    else:
                        desc2 = desc.rstrip() + "\n\n" + line + "\n"
                    body = {"id": prev, "snippet": {
                        "title": sn["title"],
                        "description": desc2[:4900],
                        "categoryId": sn.get("categoryId") or "1",
                        "tags": sn.get("tags") or [],
                        "defaultLanguage": sn.get("defaultLanguage") or "en",
                    }}
                    api("PUT", "https://www.googleapis.com/youtube/v3/videos?part=snippet", t, body)
                    out["prev_linked"] = prev
                    out["prev_link_line"] = line
        except Exception as e:
            out["prev_error"] = str(e)[:500]

    print(json.dumps(out, indent=2))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        open(os.environ["GITHUB_STEP_SUMMARY"], "a").write("```json\n" + json.dumps(out, indent=2) + "\n```\n")
    # non-zero only if nothing useful happened
    if not any(k in out for k in ("comment_id", "playlist_item", "prev_linked")):
        sys.exit(1)

if __name__ == "__main__":
    main()
